from datetime import UTC, date, datetime
from uuid import uuid4

from app.models.task import (
    PALETTE,
    RecurrenceEndType,
    RecurrenceUnit,
    TaskCreate,
    TaskOut,
    TaskState,
    TaskUpdate,
)
from app.repositories.task_repository import ORDER_STEP, TaskNode, TaskRepository
from app.services.errors import (
    CycleError,
    InvalidColorError,
    RequirementAncestorError,
    RequirementCycleError,
    SelfParentError,
    SelfRequirementError,
    TaskNotEligibleForBacklogOverrideError,
    TaskNotFoundError,
    TaskNotLeafError,
)
from app.services.graph_utils import is_reachable, leaf_descendants


def _order_of(node: TaskNode) -> float:
    try:
        return float(node.fields.get("order", 0))
    except (TypeError, ValueError):
        return 0.0


def _sorted_by_order(ids: set[str] | list[str], graph: dict[str, TaskNode]) -> list[str]:
    return sorted(ids, key=lambda task_id: (_order_of(graph[task_id]), task_id))


_FINISHED_STATES = {TaskState.sprint_done, TaskState.done}


def _compute_state(task_id: str, graph: dict[str, TaskNode]) -> TaskState:
    node = graph[task_id]
    ever_had_children = node.fields.get("ever_had_children") == "1"
    if not node.children and not ever_had_children:
        return TaskState(node.fields.get("state", TaskState.backlog.value))

    leaf_states: set[TaskState] = set()
    if node.children:
        visited: set[str] = set()
        stack = [task_id]
        while stack:
            current = stack.pop()
            if current in visited:
                continue
            visited.add(current)
            current_node = graph[current]
            if not current_node.children:
                state = current_node.fields.get("state", TaskState.backlog.value)
                leaf_states.add(TaskState(state))
            else:
                stack.extend(current_node.children)
    # else: a childless former-goal (its last child was deleted outright,
    # not completed) -- leaf_states stays empty rather than reading the
    # node's own raw state, so it falls through to the same override check
    # and backlog default as a goal with all-finished children (v03 item 10).

    # A "kept as backlog" override (set via keep_as_backlog, when the user
    # declines to remove a parent whose children are all finished, or whose
    # last child was deleted outright) only applies while that same
    # finished-ness (or childlessness) still holds -- the moment a child is
    # reopened or a new not-yet-finished child is added, this condition goes
    # false and the override is silently bypassed, falling through to
    # normal live computation below. No explicit clear-on-event logic is
    # needed; it's just another input to the same derivation.
    if node.fields.get("state_override") == TaskState.backlog.value and (
        not leaf_states or leaf_states <= _FINISHED_STATES
    ):
        return TaskState.backlog

    if leaf_states and all(state == TaskState.done for state in leaf_states):
        return TaskState.done
    if any(
        state in (TaskState.in_progress, TaskState.sprint_done, TaskState.done)
        for state in leaf_states
    ):
        return TaskState.in_progress
    return TaskState.backlog


def _estimated_hours(task_id: str, graph: dict[str, TaskNode]) -> float | None:
    node = graph[task_id]
    if not node.children:
        raw = node.fields.get("estimated_hours")
        return float(raw) if raw not in (None, "") else None

    total = 0.0
    for leaf_id in leaf_descendants(task_id, graph):
        raw = graph[leaf_id].fields.get("estimated_hours")
        if raw not in (None, ""):
            total += float(raw)
    return total


def _compute_effective_colors(
    task_id: str, graph: dict[str, TaskNode], memo: dict[str, set[str]]
) -> set[str]:
    if task_id in memo:
        return memo[task_id]
    node = graph[task_id]
    if node.colors:
        result = set(node.colors)
    else:
        result = set()
        for parent_id in node.parents:
            result |= _compute_effective_colors(parent_id, graph, memo)
    memo[task_id] = result
    return result


class TaskService:
    def __init__(self, repo: TaskRepository) -> None:
        self._repo = repo

    def _to_task_out(
        self, task_id: str, graph: dict[str, TaskNode], color_memo: dict[str, set[str]]
    ) -> TaskOut:
        node = graph[task_id]
        is_recurrent_task = node.fields.get("is_recurrent_task") == "1"
        days_of_week_raw = node.fields.get("recurrence_days_of_week", "")
        return TaskOut(
            id=task_id,
            name=node.fields.get("name", ""),
            description=node.fields.get("description", ""),
            definition_of_done=node.fields.get("definition_of_done", ""),
            state=_compute_state(task_id, graph),
            created_at=datetime.fromisoformat(node.fields["created_at"]),
            colors=sorted(node.colors),
            effective_colors=sorted(_compute_effective_colors(task_id, graph, color_memo)),
            is_leaf=not node.children and node.fields.get("ever_had_children") != "1",
            parent_ids=sorted(node.parents),
            children_ids=_sorted_by_order(node.children, graph),
            order=_order_of(node),
            requires_ids=sorted(node.requires),
            required_by_ids=sorted(node.required_by),
            estimated_hours=_estimated_hours(task_id, graph),
            ever_had_children=node.fields.get("ever_had_children") == "1",
            is_recurrent_task=is_recurrent_task,
            recurrence_interval=(
                int(node.fields["recurrence_interval"]) if is_recurrent_task else None
            ),
            recurrence_unit=(
                RecurrenceUnit(node.fields["recurrence_unit"]) if is_recurrent_task else None
            ),
            recurrence_days_of_week=(
                [int(d) for d in days_of_week_raw.split(",") if d] if is_recurrent_task else []
            ),
            recurrence_end_type=(
                RecurrenceEndType(node.fields["recurrence_end_type"])
                if is_recurrent_task
                else None
            ),
            recurrence_end_date=(
                date.fromisoformat(node.fields["recurrence_end_date"])
                if is_recurrent_task and node.fields.get("recurrence_end_date")
                else None
            ),
            is_recurrent_group=node.fields.get("is_recurrent_group") == "1",
            recurrent_parent_id=node.fields.get("recurrent_parent_id") or None,
            recurrent_order=(
                float(node.fields["recurrent_order"])
                if node.fields.get("recurrent_order")
                else None
            ),
            recurrence_end_count=(
                int(node.fields["recurrence_end_count"])
                if is_recurrent_task and node.fields.get("recurrence_end_count")
                else None
            ),
        )

    async def create_task(self, payload: TaskCreate) -> TaskOut:
        task_id = str(uuid4())
        now = datetime.now(UTC)
        parent_ids = list(dict.fromkeys(payload.parent_ids))
        for parent_id in parent_ids:
            if not await self._repo.exists(parent_id):
                raise TaskNotFoundError(parent_id)

        invalid = sorted(set(payload.colors) - set(PALETTE))
        if invalid:
            raise InvalidColorError(invalid)

        order = await self._repo.next_order()
        await self._repo.create(
            task_id,
            {
                "name": payload.name,
                "description": payload.description,
                "definition_of_done": payload.definition_of_done,
                "state": TaskState.backlog.value,
                "created_at": now.isoformat(),
                "order": str(order),
            },
        )
        for parent_id in parent_ids:
            await self._repo.add_child_edge(parent_id, task_id)
        if payload.colors:
            await self._repo.set_colors(task_id, payload.colors)

        return await self.get_task(task_id)

    async def list_tasks(self) -> list[TaskOut]:
        graph = await self._repo.load_graph()
        color_memo: dict[str, set[str]] = {}
        return [self._to_task_out(task_id, graph, color_memo) for task_id in graph]

    async def get_task(self, task_id: str) -> TaskOut:
        graph = await self._repo.load_graph()
        if task_id not in graph:
            raise TaskNotFoundError(task_id)
        return self._to_task_out(task_id, graph, {})

    async def update_task(self, task_id: str, payload: TaskUpdate) -> TaskOut:
        node = await self._repo.load_node(task_id)
        if node is None:
            raise TaskNotFoundError(task_id)

        fields = {}
        if payload.name is not None:
            fields["name"] = payload.name
        if payload.description is not None:
            fields["description"] = payload.description
        if payload.definition_of_done is not None:
            fields["definition_of_done"] = payload.definition_of_done
        if payload.estimated_hours is not None:
            if node.children:
                raise TaskNotLeafError(task_id)
            fields["estimated_hours"] = str(payload.estimated_hours)
        if fields:
            await self._repo.update_fields(task_id, fields)

        if payload.colors is not None:
            invalid = sorted(set(payload.colors) - set(PALETTE))
            if invalid:
                raise InvalidColorError(invalid)
            await self._repo.set_colors(task_id, payload.colors)

        return await self.get_task(task_id)

    async def delete_task(self, task_id: str) -> None:
        if not await self._repo.exists(task_id):
            raise TaskNotFoundError(task_id)
        await self._repo.delete(task_id)

    async def add_parent(self, task_id: str, parent_id: str) -> TaskOut:
        if task_id == parent_id:
            raise SelfParentError(task_id)

        graph = await self._repo.load_graph()
        if task_id not in graph:
            raise TaskNotFoundError(task_id)
        if parent_id not in graph:
            raise TaskNotFoundError(parent_id)

        if parent_id in graph[task_id].parents:
            return await self.get_task(task_id)

        if is_reachable(task_id, parent_id, lambda tid: graph[tid].children):
            raise CycleError(task_id, parent_id)

        await self._repo.add_child_edge(parent_id, task_id)
        return await self.get_task(task_id)

    async def remove_parent(self, task_id: str, parent_id: str) -> TaskOut:
        if not await self._repo.exists(task_id):
            raise TaskNotFoundError(task_id)
        await self._repo.remove_child_edge(parent_id, task_id)
        return await self.get_task(task_id)

    async def reorder_task(
        self,
        task_id: str,
        after_id: str | None,
        before_id: str | None,
        order: float | None = None,
    ) -> TaskOut:
        """Place task_id's global order value between after_id and before_id.

        Ordering is a single value shared across the whole DAG (not scoped
        per-parent), so "between" here means immediately adjacent in that one
        global order, regardless of which list (root list, some parent's
        children) the caller is actually reordering within.

        If order is given, it's set directly instead (used to restore an
        exact prior value on undo).
        """
        if order is not None:
            if not await self._repo.exists(task_id):
                raise TaskNotFoundError(task_id)
            await self._repo.update_fields(task_id, {"order": str(order)})
            return await self.get_task(task_id)

        graph = await self._repo.load_graph()
        if task_id not in graph:
            raise TaskNotFoundError(task_id)
        if after_id is not None and after_id not in graph:
            raise TaskNotFoundError(after_id)
        if before_id is not None and before_id not in graph:
            raise TaskNotFoundError(before_id)

        after_order = _order_of(graph[after_id]) if after_id is not None else None
        before_order = _order_of(graph[before_id]) if before_id is not None else None

        if after_order is not None and before_order is not None:
            candidate = (after_order + before_order) / 2
            exhausted = candidate <= after_order or candidate >= before_order
        elif after_order is not None:
            candidate = after_order + ORDER_STEP
            exhausted = False
        elif before_order is not None:
            candidate = before_order - ORDER_STEP
            exhausted = False
        else:
            candidate = 0.0
            exhausted = False

        if exhausted:
            await self._rebalance_order(graph, task_id, after_id)
        else:
            await self._repo.update_fields(task_id, {"order": str(candidate)})

        return await self.get_task(task_id)

    async def _rebalance_order(
        self, graph: dict[str, TaskNode], task_id: str, after_id: str | None
    ) -> None:
        """Evenly re-space every task's order, inserting task_id right after after_id.

        Triggered when two neighbors' order values are float-adjacent, so no
        midpoint can be represented between them anymore.
        """
        ordered_ids = [tid for tid in _sorted_by_order(list(graph.keys()), graph) if tid != task_id]
        insert_at = 0 if after_id is None else ordered_ids.index(after_id) + 1
        ordered_ids.insert(insert_at, task_id)
        for index, tid in enumerate(ordered_ids):
            await self._repo.update_fields(tid, {"order": str(index * ORDER_STEP)})

    async def add_requirement(self, task_id: str, required_id: str) -> TaskOut:
        """Mark required_id as a prerequisite of task_id (task_id can't be
        scheduled until required_id reaches `done` -- enforced in
        IntervalService, not here). A separate edge-set from the parent/child
        DAG, with its own cycle guard.
        """
        if task_id == required_id:
            raise SelfRequirementError(task_id)
        if not await self._repo.exists(task_id):
            raise TaskNotFoundError(task_id)
        if not await self._repo.exists(required_id):
            raise TaskNotFoundError(required_id)

        requires_graph = await self._repo.load_requirement_graph()
        # Adding task_id -> required_id would cycle if required_id can
        # already (transitively) reach task_id, i.e. task_id is already one
        # of required_id's own prerequisites.
        if is_reachable(required_id, task_id, lambda tid: requires_graph.get(tid, set())):
            raise RequirementCycleError(task_id, required_id)

        # A task's completion is already derived from its own descendants
        # (see _compute_state), so requiring an ancestor would make task_id's
        # completion depend on required_id, which itself depends on task_id --
        # a cycle across the parent/child DAG and the requirement DAG that
        # the check above (requirement-DAG-only) can't catch on its own.
        graph = await self._repo.load_graph()
        if is_reachable(task_id, required_id, lambda tid: graph[tid].parents):
            raise RequirementAncestorError(task_id, required_id)

        await self._repo.add_requirement_edge(task_id, required_id)
        return await self.get_task(task_id)

    async def remove_requirement(self, task_id: str, required_id: str) -> TaskOut:
        if not await self._repo.exists(task_id):
            raise TaskNotFoundError(task_id)
        await self._repo.remove_requirement_edge(task_id, required_id)
        return await self.get_task(task_id)

    async def keep_as_backlog(self, task_id: str) -> TaskOut:
        """Called when the user declines to remove a parent whose children
        have all finished (v01 item 10's confirmation) -- forces its display
        to `backlog` (see the override check in _compute_state) instead of
        the `done` it would otherwise live-compute to, so it reads as a
        fresh, reusable container rather than a finished task.
        """
        graph = await self._repo.load_graph()
        if task_id not in graph:
            raise TaskNotFoundError(task_id)

        node = graph[task_id]
        if not node.children and node.fields.get("ever_had_children") != "1":
            raise TaskNotEligibleForBacklogOverrideError(task_id)

        if node.children:
            leaf_states = {
                TaskState(graph[leaf_id].fields.get("state", TaskState.backlog.value))
                for leaf_id in leaf_descendants(task_id, graph)
            }
            if not leaf_states or not leaf_states <= _FINISHED_STATES:
                raise TaskNotEligibleForBacklogOverrideError(task_id)
        # else: last remaining child was deleted outright, leaving this
        # childless -- vacuously eligible, mirroring the frontend's
        # qualifiesForRemovalPrompt (v03 item 10).

        await self._repo.update_fields(task_id, {"state_override": TaskState.backlog.value})
        return await self.get_task(task_id)

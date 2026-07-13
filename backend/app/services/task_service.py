from datetime import UTC, datetime
from uuid import uuid4

from app.models.task import PALETTE, TaskCreate, TaskOut, TaskState, TaskUpdate
from app.repositories.task_repository import TaskNode, TaskRepository
from app.services.errors import CycleError, InvalidColorError, SelfParentError, TaskNotFoundError


def _is_reachable(start_id: str, target_id: str, graph: dict[str, TaskNode]) -> bool:
    """Whether target_id can be reached from start_id by following children edges."""
    visited: set[str] = set()
    stack = [start_id]
    while stack:
        current = stack.pop()
        if current == target_id:
            return True
        if current in visited:
            continue
        visited.add(current)
        stack.extend(graph[current].children)
    return False


def _compute_state(task_id: str, graph: dict[str, TaskNode]) -> TaskState:
    node = graph[task_id]
    if not node.children:
        return TaskState(node.fields.get("state", TaskState.backlog.value))

    leaf_states: set[TaskState] = set()
    visited: set[str] = set()
    stack = [task_id]
    while stack:
        current = stack.pop()
        if current in visited:
            continue
        visited.add(current)
        current_node = graph[current]
        if not current_node.children:
            leaf_states.add(TaskState(current_node.fields.get("state", TaskState.backlog.value)))
        else:
            stack.extend(current_node.children)

    if leaf_states and all(state == TaskState.done for state in leaf_states):
        return TaskState.done
    if any(
        state in (TaskState.in_progress, TaskState.sprint_done, TaskState.done)
        for state in leaf_states
    ):
        return TaskState.in_progress
    return TaskState.backlog


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
        return TaskOut(
            id=task_id,
            name=node.fields.get("name", ""),
            description=node.fields.get("description", ""),
            definition_of_done=node.fields.get("definition_of_done", ""),
            state=_compute_state(task_id, graph),
            created_at=datetime.fromisoformat(node.fields["created_at"]),
            colors=sorted(node.colors),
            effective_colors=sorted(_compute_effective_colors(task_id, graph, color_memo)),
            is_leaf=not node.children,
            parent_ids=sorted(node.parents),
            children_ids=sorted(node.children),
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

        await self._repo.create(
            task_id,
            {
                "name": payload.name,
                "description": payload.description,
                "definition_of_done": payload.definition_of_done,
                "state": TaskState.backlog.value,
                "created_at": now.isoformat(),
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
        if not await self._repo.exists(task_id):
            raise TaskNotFoundError(task_id)

        fields = {}
        if payload.name is not None:
            fields["name"] = payload.name
        if payload.description is not None:
            fields["description"] = payload.description
        if payload.definition_of_done is not None:
            fields["definition_of_done"] = payload.definition_of_done
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
            return self._to_task_out(task_id, graph, {})

        if _is_reachable(task_id, parent_id, graph):
            raise CycleError(task_id, parent_id)

        await self._repo.add_child_edge(parent_id, task_id)
        return await self.get_task(task_id)

    async def remove_parent(self, task_id: str, parent_id: str) -> TaskOut:
        if not await self._repo.exists(task_id):
            raise TaskNotFoundError(task_id)
        await self._repo.remove_child_edge(parent_id, task_id)
        return await self.get_task(task_id)

from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

from app.models.entry import EntryOut
from app.models.task import TaskState
from app.repositories.entry_repository import EntryRepository
from app.repositories.task_repository import TaskRepository
from app.services.errors import (
    NoActiveTimerError,
    PrerequisiteNotSprintDoneError,
    TaskNotFoundError,
    TaskNotInProgressError,
    TaskNotLeafError,
    TaskNotSprintDoneError,
)
from app.services.graph_utils import leaf_descendants
from app.services.task_service import TaskService

_FINISHED_STATES = {TaskState.sprint_done, TaskState.done}


class TimerService:
    def __init__(
        self,
        entry_repo: EntryRepository,
        task_repo: TaskRepository,
        task_service: TaskService | None = None,
    ) -> None:
        self._entries = entry_repo
        self._tasks = task_repo
        self._task_service = task_service or TaskService(task_repo)

    async def start(self, task_id: str) -> EntryOut:
        task_node = await self._tasks.load_node(task_id)
        if task_node is None:
            raise TaskNotFoundError(task_id)
        if task_node.children:
            raise TaskNotLeafError(task_id)

        if task_node.requires:
            unmet = []
            for required_id in task_node.requires:
                required_task = await self._task_service.get_task(required_id)
                if required_task.state not in (TaskState.sprint_done, TaskState.done):
                    unmet.append(required_id)
            if unmet:
                raise PrerequisiteNotSprintDoneError(task_id, unmet)

        now = datetime.now(UTC)

        active_id = await self._entries.get_active_id()
        if active_id is not None:
            await self._entries.set_end(active_id, now)

        task_name = task_node.fields.get("name", "")
        entry_id = str(uuid4())
        await self._entries.create(entry_id, task_id, now, task_name)
        await self._entries.set_active_id(entry_id)
        await self._tasks.update_fields(task_id, {"state": TaskState.in_progress.value})

        return EntryOut(id=entry_id, task_id=task_id, start=now, end=None, task_name=task_name)

    async def stop(self) -> EntryOut:
        active_id = await self._entries.get_active_id()
        if active_id is None:
            raise NoActiveTimerError

        now = datetime.now(UTC)
        data = await self._entries.set_end(active_id, now)
        await self._entries.set_active_id(None)

        return self._to_out(active_id, data)

    async def mark_done(self, task_id: str) -> None:
        task_node = await self._tasks.load_node(task_id)
        if task_node is None:
            raise TaskNotFoundError(task_id)

        state = TaskState(task_node.fields.get("state", TaskState.backlog.value))
        if state != TaskState.in_progress:
            raise TaskNotInProgressError(task_id)

        await self._tasks.update_fields(task_id, {"state": TaskState.sprint_done.value})

    async def revert_done(self, task_id: str) -> None:
        """Undo the sprint_done transition made via mark_done, back to
        in_progress -- does not resurrect the timer entry, which was already
        stopped/recorded independently of this decision (see item 16c)."""
        task_node = await self._tasks.load_node(task_id)
        if task_node is None:
            raise TaskNotFoundError(task_id)

        state = TaskState(task_node.fields.get("state", TaskState.backlog.value))
        if state != TaskState.sprint_done:
            raise TaskNotSprintDoneError(task_id)

        await self._tasks.update_fields(task_id, {"state": TaskState.in_progress.value})

    async def mark_subtree_done(self, task_id: str) -> list[str]:
        """Force every not-yet-finished leaf in task_id's subtree straight
        to sprint_done -- a leaf-task no-op subtree of itself if task_id is
        already a leaf (see leaf_descendants). Deliberately bypasses
        mark_done's in_progress-only precondition, since a right-click
        "mark subtree done" is expected to work regardless of which leaves
        happen to be actively tracked -- mark_done itself is untouched, its
        precondition still applies unchanged to its own callers. Returns
        the leaf ids actually changed, so the caller can build a matching
        undo entry.
        """
        graph = await self._tasks.load_graph()
        if task_id not in graph:
            raise TaskNotFoundError(task_id)

        affected: list[str] = []
        for leaf_id in leaf_descendants(task_id, graph):
            state = TaskState(graph[leaf_id].fields.get("state", TaskState.backlog.value))
            if state in _FINISHED_STATES:
                continue
            await self._tasks.update_fields(leaf_id, {"state": TaskState.sprint_done.value})
            affected.append(leaf_id)
        return affected

    async def get_active(self) -> EntryOut | None:
        active_id = await self._entries.get_active_id()
        if active_id is None:
            return None
        data = await self._entries.get(active_id)
        if data is None:
            return None
        return self._to_out(active_id, data)

    async def list_for_week(self, week_start: str) -> list[EntryOut]:
        start_date = date.fromisoformat(week_start)
        start_ts = datetime(
            start_date.year, start_date.month, start_date.day, tzinfo=UTC
        ).timestamp()
        end_ts = start_ts + timedelta(days=7).total_seconds()
        entries = await self._entries.list_for_range(start_ts, end_ts)
        return [self._to_out(entry["id"], entry) for entry in entries]

    def _to_out(self, entry_id: str, data: dict) -> EntryOut:
        return EntryOut(
            id=entry_id,
            task_id=data["task_id"],
            start=datetime.fromisoformat(data["start"]),
            end=datetime.fromisoformat(data["end"]) if data.get("end") else None,
            task_name=data.get("task_name"),
        )

from datetime import datetime
from uuid import uuid4

from app.models.interval import IntervalCreate, IntervalOut, IntervalUpdate
from app.models.task import TaskState
from app.repositories.interval_repository import IntervalRepository
from app.repositories.task_repository import TaskRepository
from app.services.errors import (
    IntervalNotFoundError,
    InvalidIntervalError,
    TaskNotFoundError,
    TaskNotLeafError,
    UnmetPrerequisiteError,
)
from app.services.graph_utils import leaf_descendants
from app.services.task_service import TaskService


class IntervalService:
    def __init__(
        self,
        interval_repo: IntervalRepository,
        task_repo: TaskRepository,
        task_service: TaskService | None = None,
    ) -> None:
        self._intervals = interval_repo
        self._tasks = task_repo
        # Optional so existing call sites/tests that don't care about
        # prerequisites don't need to wire it up; defaults to a fresh
        # TaskService over the same repo.
        self._task_service = task_service or TaskService(task_repo)

    async def create_interval(self, payload: IntervalCreate) -> IntervalOut:
        if payload.end <= payload.start:
            raise InvalidIntervalError

        task_node = await self._tasks.load_node(payload.task_id)
        if task_node is None:
            raise TaskNotFoundError(payload.task_id)
        if task_node.children:
            raise TaskNotLeafError(payload.task_id)

        if task_node.requires:
            unmet = []
            for required_id in task_node.requires:
                required_task = await self._task_service.get_task(required_id)
                if required_task.state != TaskState.done:
                    unmet.append(required_id)
            if unmet:
                raise UnmetPrerequisiteError(payload.task_id, unmet)

        interval_id = str(uuid4())
        week_start = await self._intervals.create(
            interval_id, payload.task_id, payload.start, payload.end
        )

        current_state = TaskState(task_node.fields.get("state", TaskState.backlog.value))
        if current_state == TaskState.backlog:
            await self._tasks.update_fields(
                payload.task_id, {"state": TaskState.sprint_backlog.value}
            )

        return IntervalOut(
            id=interval_id,
            task_id=payload.task_id,
            start=payload.start,
            end=payload.end,
            week_start=week_start,
        )

    async def update_interval(self, interval_id: str, payload: IntervalUpdate) -> IntervalOut:
        if payload.end <= payload.start:
            raise InvalidIntervalError

        data = await self._intervals.get(interval_id)
        if data is None:
            raise IntervalNotFoundError(interval_id)

        week_start = await self._intervals.update(interval_id, payload.start, payload.end)
        return IntervalOut(
            id=interval_id,
            task_id=data["task_id"],
            start=payload.start,
            end=payload.end,
            week_start=week_start,
        )

    async def delete_interval(self, interval_id: str) -> None:
        data = await self._intervals.delete(interval_id)
        if data is None:
            raise IntervalNotFoundError(interval_id)

        task_id = data["task_id"]
        remaining = await self._intervals.count_for_task(task_id)
        if remaining == 0:
            task_node = await self._tasks.load_node(task_id)
            if task_node is not None:
                state = TaskState(task_node.fields.get("state", TaskState.backlog.value))
                if state == TaskState.sprint_backlog:
                    await self._tasks.update_fields(task_id, {"state": TaskState.backlog.value})

    async def get_coverage_hours(self, task_id: str) -> float:
        """Hours currently reserved on the calendar for task_id -- its own
        intervals if it's a leaf, or summed across its leaf descendants if
        it's a goal. Computed on demand (not part of the bulk task list)
        since it requires per-leaf interval lookups, unlike the graph-only
        data list_tasks() already has loaded for free.
        """
        graph = await self._tasks.load_graph()
        if task_id not in graph:
            raise TaskNotFoundError(task_id)

        total_seconds = 0.0
        for leaf_id in leaf_descendants(task_id, graph):
            for interval in await self._intervals.list_for_task(leaf_id):
                start = datetime.fromisoformat(interval["start"])
                end = datetime.fromisoformat(interval["end"])
                total_seconds += (end - start).total_seconds()
        return total_seconds / 3600

    async def list_for_week(self, week_start: str) -> list[IntervalOut]:
        intervals = await self._intervals.list_for_week(week_start)
        return [self._to_out(interval) for interval in intervals]

    async def list_for_task(self, task_id: str) -> list[IntervalOut]:
        intervals = await self._intervals.list_for_task(task_id)
        return [self._to_out(interval) for interval in intervals]

    def _to_out(self, data: dict) -> IntervalOut:
        return IntervalOut(
            id=data["id"],
            task_id=data["task_id"],
            start=datetime.fromisoformat(data["start"]),
            end=datetime.fromisoformat(data["end"]),
            week_start=data["week_start"],
        )

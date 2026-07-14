from collections import defaultdict
from datetime import UTC, date, datetime, timedelta

from pydantic import BaseModel

from app.models.task import TaskState
from app.repositories.entry_repository import EntryRepository
from app.repositories.interval_repository import IntervalRepository, monday_of
from app.repositories.task_repository import TaskNode, TaskRepository
from app.services.period_utils import Granularity, period_bounds

__all__ = ["EvaluatePeriodResult", "EvaluateService", "Granularity"]

FINISHED_STATES = {TaskState.sprint_done, TaskState.done}


class TaskPeriodStats(BaseModel):
    task_id: str
    name: str
    is_leaf: bool
    planned_hours: float
    executed_hours: float
    percentage: float | None
    finished_count: int
    not_finished_count: int


class PeriodStats(BaseModel):
    period_start: str
    period_end: str
    planned_hours: float
    executed_hours: float
    percentage: float | None
    finished_count: int
    not_finished_count: int


class EvaluatePeriodResult(BaseModel):
    period: PeriodStats
    by_task: list[TaskPeriodStats]


def _hours(seconds: float) -> float:
    return round(seconds / 3600, 2)


def _percentage(executed: float, planned: float) -> float | None:
    return round(executed / planned * 100, 1) if planned > 0 else None


def _descendant_leaves(task_id: str, graph: dict[str, TaskNode]) -> set[str]:
    result: set[str] = set()
    stack = list(graph[task_id].children)
    while stack:
        current = stack.pop()
        if current in result:
            continue
        node = graph[current]
        if not node.children:
            result.add(current)
        else:
            stack.extend(node.children)
    return result


class EvaluateService:
    def __init__(
        self,
        task_repo: TaskRepository,
        interval_repo: IntervalRepository,
        entry_repo: EntryRepository,
    ) -> None:
        self._tasks = task_repo
        self._intervals = interval_repo
        self._entries = entry_repo

    async def evaluate_period(
        self, granularity: Granularity, anchor: date, task_ids: list[str] | None = None
    ) -> EvaluatePeriodResult:
        start, end = period_bounds(granularity, anchor)
        range_start_dt = datetime(start.year, start.month, start.day, tzinfo=UTC)
        range_end_dt = datetime(end.year, end.month, end.day, tzinfo=UTC)

        intervals = await self._list_intervals_for_period(start, end)
        entries = await self._entries.list_for_range(
            range_start_dt.timestamp(), range_end_dt.timestamp()
        )

        planned_seconds: dict[str, float] = defaultdict(float)
        for interval in intervals:
            istart = datetime.fromisoformat(interval["start"])
            iend = datetime.fromisoformat(interval["end"])
            planned_seconds[interval["task_id"]] += (iend - istart).total_seconds()

        executed_seconds: dict[str, float] = defaultdict(float)
        for entry in entries:
            estart = datetime.fromisoformat(entry["start"])
            eend = datetime.fromisoformat(entry["end"]) if entry.get("end") else datetime.now(UTC)
            executed_seconds[entry["task_id"]] += (eend - estart).total_seconds()

        relevant_leaf_ids = set(planned_seconds) | set(executed_seconds)
        graph = await self._tasks.load_graph()

        if task_ids:
            selected: set[str] = set()
            for task_id in task_ids:
                selected.add(task_id)
                if task_id in graph:
                    selected |= _descendant_leaves(task_id, graph)
            relevant_leaf_ids &= selected

        finished_leaf_ids = {
            leaf_id
            for leaf_id in relevant_leaf_ids
            if leaf_id in graph
            and TaskState(graph[leaf_id].fields.get("state", TaskState.backlog.value))
            in FINISHED_STATES
        }

        by_task: list[TaskPeriodStats] = []

        for leaf_id in relevant_leaf_ids:
            node = graph.get(leaf_id)
            name = node.fields.get("name", leaf_id) if node else leaf_id
            planned = planned_seconds.get(leaf_id, 0.0)
            executed = executed_seconds.get(leaf_id, 0.0)
            finished = leaf_id in finished_leaf_ids
            by_task.append(
                TaskPeriodStats(
                    task_id=leaf_id,
                    name=name,
                    is_leaf=True,
                    planned_hours=_hours(planned),
                    executed_hours=_hours(executed),
                    percentage=_percentage(executed, planned),
                    finished_count=1 if finished else 0,
                    not_finished_count=0 if finished else 1,
                )
            )

        ancestor_ids: set[str] = set()
        for leaf_id in relevant_leaf_ids:
            stack = list(graph[leaf_id].parents) if leaf_id in graph else []
            while stack:
                current = stack.pop()
                if current in ancestor_ids:
                    continue
                ancestor_ids.add(current)
                stack.extend(graph[current].parents)

        for node_id in ancestor_ids:
            descendants = _descendant_leaves(node_id, graph) & relevant_leaf_ids
            planned = sum(planned_seconds.get(lid, 0.0) for lid in descendants)
            executed = sum(executed_seconds.get(lid, 0.0) for lid in descendants)
            finished = sum(1 for lid in descendants if lid in finished_leaf_ids)
            node = graph[node_id]
            by_task.append(
                TaskPeriodStats(
                    task_id=node_id,
                    name=node.fields.get("name", node_id),
                    is_leaf=False,
                    planned_hours=_hours(planned),
                    executed_hours=_hours(executed),
                    percentage=_percentage(executed, planned),
                    finished_count=finished,
                    not_finished_count=len(descendants) - finished,
                )
            )

        by_task.sort(key=lambda stats: stats.name.lower())

        total_planned = sum(planned_seconds.get(lid, 0.0) for lid in relevant_leaf_ids)
        total_executed = sum(executed_seconds.get(lid, 0.0) for lid in relevant_leaf_ids)
        period_stats = PeriodStats(
            period_start=start.isoformat(),
            period_end=end.isoformat(),
            planned_hours=_hours(total_planned),
            executed_hours=_hours(total_executed),
            percentage=_percentage(total_executed, total_planned),
            finished_count=len(finished_leaf_ids),
            not_finished_count=len(relevant_leaf_ids) - len(finished_leaf_ids),
        )

        return EvaluatePeriodResult(period=period_stats, by_task=by_task)

    async def _list_intervals_for_period(self, start: date, end: date) -> list[dict]:
        week_starts: set[date] = set()
        cursor = monday_of(start)
        while cursor < end:
            week_starts.add(cursor)
            cursor += timedelta(days=7)

        # Compared as naive: interval timestamps may or may not carry a
        # timezone offset depending on how the client submitted them, so
        # normalize both sides rather than requiring tz-awareness everywhere.
        range_start_dt = datetime(start.year, start.month, start.day)
        range_end_dt = datetime(end.year, end.month, end.day)

        seen_ids: set[str] = set()
        results: list[dict] = []
        for week_start in week_starts:
            for interval in await self._intervals.list_for_week(week_start.isoformat()):
                if interval["id"] in seen_ids:
                    continue
                seen_ids.add(interval["id"])
                interval_start = datetime.fromisoformat(interval["start"]).replace(tzinfo=None)
                if range_start_dt <= interval_start < range_end_dt:
                    results.append(interval)
        return results

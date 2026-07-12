from collections import defaultdict
from datetime import UTC, date, datetime, timedelta

from pydantic import BaseModel

from app.models.task import TaskState
from app.repositories.entry_repository import EntryRepository
from app.repositories.interval_repository import IntervalRepository
from app.repositories.task_repository import TaskNode, TaskRepository

FINISHED_STATES = {TaskState.sprint_done, TaskState.done}


class TaskWeekStats(BaseModel):
    task_id: str
    name: str
    is_leaf: bool
    planned_hours: float
    executed_hours: float
    percentage: float | None
    finished_count: int
    not_finished_count: int


class WeekStats(BaseModel):
    week_start: str
    planned_hours: float
    executed_hours: float
    percentage: float | None
    finished_count: int
    not_finished_count: int


class EvaluateWeekResult(BaseModel):
    week: WeekStats
    by_task: list[TaskWeekStats]


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

    async def evaluate_week(self, week_start: str) -> EvaluateWeekResult:
        start_date = date.fromisoformat(week_start)
        range_start = datetime(start_date.year, start_date.month, start_date.day, tzinfo=UTC)
        start_ts = range_start.timestamp()
        end_ts = (range_start + timedelta(days=7)).timestamp()

        intervals = await self._intervals.list_for_week(week_start)
        entries = await self._entries.list_for_range(start_ts, end_ts)

        planned_seconds: dict[str, float] = defaultdict(float)
        for interval in intervals:
            start = datetime.fromisoformat(interval["start"])
            end = datetime.fromisoformat(interval["end"])
            planned_seconds[interval["task_id"]] += (end - start).total_seconds()

        executed_seconds: dict[str, float] = defaultdict(float)
        for entry in entries:
            start = datetime.fromisoformat(entry["start"])
            end = datetime.fromisoformat(entry["end"]) if entry.get("end") else datetime.now(UTC)
            executed_seconds[entry["task_id"]] += (end - start).total_seconds()

        relevant_leaf_ids = set(planned_seconds) | set(executed_seconds)
        graph = await self._tasks.load_graph()

        finished_leaf_ids = {
            leaf_id
            for leaf_id in relevant_leaf_ids
            if leaf_id in graph
            and TaskState(graph[leaf_id].fields.get("state", TaskState.backlog.value))
            in FINISHED_STATES
        }

        by_task: list[TaskWeekStats] = []

        for leaf_id in relevant_leaf_ids:
            node = graph.get(leaf_id)
            name = node.fields.get("name", leaf_id) if node else leaf_id
            planned = planned_seconds.get(leaf_id, 0.0)
            executed = executed_seconds.get(leaf_id, 0.0)
            finished = leaf_id in finished_leaf_ids
            by_task.append(
                TaskWeekStats(
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
                TaskWeekStats(
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

        total_planned = sum(planned_seconds.values())
        total_executed = sum(executed_seconds.values())
        week_stats = WeekStats(
            week_start=week_start,
            planned_hours=_hours(total_planned),
            executed_hours=_hours(total_executed),
            percentage=_percentage(total_executed, total_planned),
            finished_count=len(finished_leaf_ids),
            not_finished_count=len(relevant_leaf_ids) - len(finished_leaf_ids),
        )

        return EvaluateWeekResult(week=week_stats, by_task=by_task)

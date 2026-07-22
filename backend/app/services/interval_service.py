from datetime import UTC, datetime
from uuid import uuid4

from app.models.interval import IntervalCreate, IntervalOut, IntervalUpdate
from app.models.task import TaskState
from app.repositories.interval_repository import IntervalRepository
from app.repositories.task_repository import TaskRepository
from app.services.errors import (
    GoogleNotConnectedError,
    GoogleSyncFailedError,
    IntervalAlreadySyncedError,
    IntervalDeleteLockedError,
    IntervalLockedError,
    IntervalNotFoundError,
    InvalidIntervalError,
    PastIntervalError,
    TaskNotFoundError,
    TaskNotLeafError,
    UnmetPrerequisiteError,
)
from app.services.google_sync_service import GoogleSyncService
from app.services.graph_utils import leaf_descendants
from app.services.task_service import TaskService


def _as_utc_naive(dt: datetime) -> datetime:
    """Normalize an interval boundary to a naive UTC datetime for comparison
    against the current time. The frontend always sends timezone-aware ISO
    timestamps, but some backend-internal/test callers pass naive datetimes
    that are implicitly UTC already (this app stores/buckets everything in
    UTC -- see PROJECT_STATUS.md).
    """
    if dt.tzinfo is not None:
        return dt.astimezone(UTC).replace(tzinfo=None)
    return dt


class IntervalService:
    def __init__(
        self,
        interval_repo: IntervalRepository,
        task_repo: TaskRepository,
        task_service: TaskService | None = None,
        google: GoogleSyncService | None = None,
    ) -> None:
        self._intervals = interval_repo
        self._tasks = task_repo
        # Optional so existing call sites/tests that don't care about
        # prerequisites don't need to wire it up; defaults to a fresh
        # TaskService over the same repo.
        self._task_service = task_service or TaskService(task_repo)
        # None means "no Google integration wired for this instance" (most
        # tests) -- treated the same as "not connected" everywhere it's used.
        self._google = google

    def _reject_if_past_start(self, start: datetime) -> None:
        now = datetime.now(UTC).replace(tzinfo=None)
        if _as_utc_naive(start) < now:
            raise PastIntervalError

    def _enforce_edit_lock(
        self, existing_start: datetime, existing_end: datetime, new_start: datetime
    ) -> None:
        """A scheduled interval's edit rules depend on where "now" falls
        relative to its *current* (pre-edit) bounds: fully past -> locked
        entirely; in progress -> its start can't move, only its end; fully
        future -> both free, but the new start still can't be pushed into
        the past. Mirrors the frontend's lib/intervalTiming.ts three-way
        split -- keep the boundary semantics identical if either changes.
        """
        now = datetime.now(UTC).replace(tzinfo=None)
        start = _as_utc_naive(existing_start)
        end = _as_utc_naive(existing_end)

        if end <= now:
            raise IntervalLockedError
        if start <= now < end:
            if _as_utc_naive(new_start) != start:
                raise IntervalLockedError
            return
        self._reject_if_past_start(new_start)

    async def _unmet_scheduling_prerequisites(
        self, required_ids: set[str], new_start: datetime
    ) -> list[str]:
        """Required tasks that block scheduling something to start at
        new_start: a task can only be scheduled for a time after each of its
        prerequisites' own latest scheduled interval ends. A prerequisite
        with no interval at all blocks scheduling outright -- "after it" is
        meaningless if it isn't scheduled yet.
        """
        unmet = []
        for required_id in required_ids:
            existing = await self._intervals.list_for_task(required_id)
            if not existing:
                unmet.append(required_id)
                continue
            latest_end = max(datetime.fromisoformat(interval["end"]) for interval in existing)
            if new_start < latest_end:
                unmet.append(required_id)
        return unmet

    async def create_interval(self, payload: IntervalCreate) -> IntervalOut:
        if payload.end <= payload.start:
            raise InvalidIntervalError
        self._reject_if_past_start(payload.start)

        task_node = await self._tasks.load_node(payload.task_id)
        if task_node is None:
            raise TaskNotFoundError(payload.task_id)
        if task_node.children:
            raise TaskNotLeafError(payload.task_id)

        if task_node.requires:
            unmet = await self._unmet_scheduling_prerequisites(task_node.requires, payload.start)
            if unmet:
                raise UnmetPrerequisiteError(payload.task_id, unmet)

        task_name = task_node.fields.get("name", "")
        interval_id = str(uuid4())
        week_start = await self._intervals.create(
            interval_id, payload.task_id, payload.start, payload.end, task_name
        )

        current_state = TaskState(task_node.fields.get("state", TaskState.backlog.value))
        if current_state == TaskState.backlog:
            await self._tasks.update_fields(
                payload.task_id, {"state": TaskState.sprint_backlog.value}
            )

        # Best-effort go-forward sync: a Google outage or being disconnected
        # must never block local scheduling, so a failed/skipped push just
        # leaves google_event_id unset rather than raising.
        google_event_id = None
        if self._google is not None and await self._google.is_connected():
            google_event_id = await self._google.push_interval(
                task_name, payload.start, payload.end
            )
            if google_event_id is not None:
                await self._intervals.set_google_event_id(interval_id, google_event_id)

        return IntervalOut(
            id=interval_id,
            task_id=payload.task_id,
            start=payload.start,
            end=payload.end,
            week_start=week_start,
            task_name=task_name,
            google_event_id=google_event_id,
        )

    async def update_interval(self, interval_id: str, payload: IntervalUpdate) -> IntervalOut:
        if payload.end <= payload.start:
            raise InvalidIntervalError

        data = await self._intervals.get(interval_id)
        if data is None:
            raise IntervalNotFoundError(interval_id)

        self._enforce_edit_lock(
            datetime.fromisoformat(data["start"]),
            datetime.fromisoformat(data["end"]),
            payload.start,
        )

        task_node = await self._tasks.load_node(data["task_id"])
        if task_node is not None and task_node.requires:
            unmet = await self._unmet_scheduling_prerequisites(task_node.requires, payload.start)
            if unmet:
                raise UnmetPrerequisiteError(data["task_id"], unmet)

        week_start = await self._intervals.update(interval_id, payload.start, payload.end)

        # Propagate to the linked Google event too, if this interval was
        # already synced (best-effort, same as create -- see there).
        existing_google_event_id = data.get("google_event_id") or None
        if existing_google_event_id and self._google is not None:
            await self._google.update_interval(
                existing_google_event_id,
                data.get("task_name") or "",
                payload.start,
                payload.end,
            )

        return IntervalOut(
            id=interval_id,
            task_id=data["task_id"],
            start=payload.start,
            end=payload.end,
            week_start=week_start,
            task_name=data.get("task_name"),
            google_event_id=existing_google_event_id,
        )

    async def push_to_google(self, interval_id: str) -> IntervalOut:
        data = await self._intervals.get(interval_id)
        if data is None:
            raise IntervalNotFoundError(interval_id)
        if data.get("google_event_id"):
            raise IntervalAlreadySyncedError(interval_id)
        if self._google is None or not await self._google.is_connected():
            raise GoogleNotConnectedError()

        event_id = await self._google.push_interval(
            data.get("task_name") or "",
            datetime.fromisoformat(data["start"]),
            datetime.fromisoformat(data["end"]),
        )
        if event_id is None:
            raise GoogleSyncFailedError()

        await self._intervals.set_google_event_id(interval_id, event_id)
        return self._to_out({**data, "id": interval_id, "google_event_id": event_id})

    async def delete_interval(self, interval_id: str) -> None:
        existing = await self._intervals.get(interval_id)
        if existing is None:
            raise IntervalNotFoundError(interval_id)

        now = datetime.now(UTC).replace(tzinfo=None)
        # Fully-past (end <= now) and in-progress (start <= now < end) are
        # both blocked from deletion -- only a fully-future interval
        # (start > now) may be deleted. Mirrors _enforce_edit_lock's
        # boundary semantics, just collapsed to a single allow/deny check
        # since there's no partial "end can still move" case for a delete.
        if _as_utc_naive(datetime.fromisoformat(existing["start"])) <= now:
            raise IntervalDeleteLockedError

        data = await self._intervals.delete(interval_id)
        if data is None:
            raise IntervalNotFoundError(interval_id)

        google_event_id = data.get("google_event_id") or None
        if google_event_id and self._google is not None:
            await self._google.delete_interval(google_event_id)

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
            task_name=data.get("task_name"),
            google_event_id=data.get("google_event_id") or None,
        )

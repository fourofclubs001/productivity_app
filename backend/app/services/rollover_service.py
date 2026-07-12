from datetime import UTC, date, datetime, timedelta

from redis.asyncio import Redis

from app.models.task import TaskState
from app.repositories.interval_repository import IntervalRepository, monday_of
from app.repositories.task_repository import task_key

LAST_PROCESSED_KEY = "rollover:last_processed_monday"

ROLLOVER_TRANSITIONS: dict[TaskState, TaskState] = {
    TaskState.sprint_done: TaskState.done,
    TaskState.in_progress: TaskState.backlog,
    TaskState.sprint_backlog: TaskState.backlog,
}


class RolloverService:
    """Applies end-of-week state transitions lazily, once per week, idempotently.

    Only tasks whose reserved interval fell within the week that just ended are
    affected; tasks scheduled for a future week are left untouched.
    """

    def __init__(self, redis: Redis, interval_repo: IntervalRepository) -> None:
        self._redis = redis
        self._intervals = interval_repo

    async def ensure_applied(self, today: date | None = None) -> None:
        today = today or datetime.now(UTC).date()
        this_monday = monday_of(today)

        last_processed_raw = await self._redis.get(LAST_PROCESSED_KEY)
        if last_processed_raw is None:
            await self._redis.set(LAST_PROCESSED_KEY, this_monday.isoformat())
            return

        last_processed = date.fromisoformat(last_processed_raw)
        while last_processed < this_monday:
            # The week starting at last_processed has now fully elapsed, since
            # today has moved into a later week; roll it over.
            await self._apply_week(last_processed.isoformat())
            last_processed = last_processed + timedelta(days=7)
            await self._redis.set(LAST_PROCESSED_KEY, last_processed.isoformat())

    async def _apply_week(self, week_start: str) -> None:
        intervals = await self._intervals.list_for_week(week_start)
        task_ids = {interval["task_id"] for interval in intervals}
        for task_id in task_ids:
            state_raw = await self._redis.hget(task_key(task_id), "state")
            if state_raw is None:
                continue
            new_state = ROLLOVER_TRANSITIONS.get(TaskState(state_raw))
            if new_state is not None:
                await self._redis.hset(task_key(task_id), "state", new_state.value)

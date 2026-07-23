from datetime import UTC, date, datetime, time, timedelta
from uuid import uuid4

from redis.asyncio import Redis

from app.models.interval import IntervalCreate
from app.models.task import (
    PALETTE,
    RecurrenceEndType,
    RecurrenceUnit,
    RecurrentGroupCreate,
    RecurrentTaskCreate,
    TaskOut,
    TaskState,
)
from app.repositories.task_repository import ORDER_STEP, TaskNode, TaskRepository
from app.services.errors import (
    InvalidColorError,
    InvalidRecurrentParentError,
    PastIntervalError,
    RecurrentGroupNotFoundError,
    TaskNotFoundError,
    TaskNotLeafError,
    UnmetPrerequisiteError,
)
from app.services.interval_service import IntervalService
from app.services.task_service import TaskService


def _recurrent_order_of(node: TaskNode) -> float:
    try:
        return float(node.fields.get("recurrent_order", 0))
    except (TypeError, ValueError):
        return 0.0

# How far ahead occurrences are lazily generated, extended on every call
# (mirrors RolloverService's "catch up on read" idiom -- this app has no
# background/cron jobs, all lazy work happens per-request).
GENERATION_WINDOW_DAYS = 28


def _days_in_month(year: int, month: int) -> int:
    next_month_first = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    return (next_month_first - date(year, month, 1)).days


def _add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, _days_in_month(year, month))
    return date(year, month, day)


def occurrence_dates(
    anchor: date,
    start_from: date,
    interval: int,
    unit: RecurrenceUnit,
    days_of_week: list[int],
    end_type: RecurrenceEndType,
    end_date: date | None,
    end_count: int | None,
    window_end: date,
) -> list[date]:
    """Occurrence dates from start_from through window_end (inclusive) that
    this recurrence rule produces.

    Always phase-locked to `anchor` -- the full theoretical sequence is
    walked from the anchor on every call (cheap at this app's scale), with
    only dates >= start_from actually returned/materialized. This is
    deliberate: stepping from `start_from` instead would drift out of phase
    with the anchor (e.g. an "every 3 days" rule resuming mid-window at an
    arbitrary date), and for month/year rules, cascading from the previous
    *candidate* rather than always re-deriving from the anchor's original
    day-of-month would silently lose that day after a clamped month (Jan 31
    -> Feb 28 -> Mar 28 instead of Mar 31).
    """
    dates: list[date] = []
    count = 0

    if unit == RecurrenceUnit.week:
        weekdays = sorted(set(days_of_week)) or [anchor.weekday()]
        anchor_week_start = anchor - timedelta(days=anchor.weekday())
        week_index = 0
        current_week = anchor_week_start
        while current_week <= window_end:
            if week_index % interval == 0:
                for weekday in weekdays:
                    candidate = current_week + timedelta(days=weekday)
                    if candidate < anchor or candidate > window_end:
                        continue
                    if end_type == RecurrenceEndType.on_date and end_date and candidate > end_date:
                        continue
                    if (
                        end_type == RecurrenceEndType.after_count
                        and end_count is not None
                        and count >= end_count
                    ):
                        continue
                    if candidate >= start_from:
                        dates.append(candidate)
                    count += 1
            current_week += timedelta(weeks=1)
            week_index += 1
        return sorted(dates)

    step = 0
    candidate = anchor
    while candidate <= window_end:
        if end_type == RecurrenceEndType.on_date and end_date and candidate > end_date:
            break
        if (
            end_type == RecurrenceEndType.after_count
            and end_count is not None
            and count >= end_count
        ):
            break
        if candidate >= start_from:
            dates.append(candidate)
        count += 1
        step += 1
        if unit == RecurrenceUnit.day:
            candidate = anchor + timedelta(days=step * interval)
        elif unit == RecurrenceUnit.month:
            candidate = _add_months(anchor, step * interval)
        else:
            candidate = _add_months(anchor, step * interval * 12)
    return dates


class RecurrentTaskService:
    def __init__(
        self,
        redis: Redis,
        task_repo: TaskRepository,
        task_service: TaskService,
        interval_service: IntervalService,
    ) -> None:
        self._redis = redis
        self._tasks = task_repo
        self._task_service = task_service
        self._intervals = interval_service

    async def create_recurrent_task(self, payload: RecurrentTaskCreate) -> TaskOut:
        invalid = sorted(set(payload.colors) - set(PALETTE))
        if invalid:
            raise InvalidColorError(invalid)

        task_id = str(uuid4())
        now = datetime.now(UTC)
        anchor = payload.start.date()
        duration_minutes = int((payload.end - payload.start).total_seconds() // 60)

        fields = {
            "name": payload.name,
            "description": "",
            "definition_of_done": payload.definition_of_done,
            "state": TaskState.backlog.value,
            "created_at": now.isoformat(),
            "order": str(await self._tasks.next_order()),
            "is_recurrent_task": "1",
            "recurrent_order": str(await self._tasks.next_recurrent_order()),
            "recurrent_task_anchor_date": anchor.isoformat(),
            "recurrent_task_start_time": payload.start.time().isoformat(),
            "recurrent_task_duration_minutes": str(duration_minutes),
            "recurrence_interval": str(payload.recurrence_interval),
            "recurrence_unit": payload.recurrence_unit.value,
            "recurrence_days_of_week": ",".join(
                str(d) for d in payload.recurrence_days_of_week
            ),
            "recurrence_end_type": payload.recurrence_end_type.value,
            # One day before the anchor, so the first ensure_applied() call
            # (below) materializes starting from the anchor itself.
            "recurrent_task_generated_until": (anchor - timedelta(days=1)).isoformat(),
        }
        if payload.recurrence_end_date is not None:
            fields["recurrence_end_date"] = payload.recurrence_end_date.isoformat()
        if payload.recurrence_end_count is not None:
            fields["recurrence_end_count"] = str(payload.recurrence_end_count)

        await self._tasks.create(task_id, fields)
        await self._tasks.add_to_recurrent_tasks(task_id)
        if payload.colors:
            await self._tasks.set_colors(task_id, payload.colors)

        await self.ensure_applied(now)
        return await self._task_service.get_task(task_id)

    async def ensure_applied(self, now: datetime | None = None) -> None:
        now = now or datetime.now(UTC)
        window_end = now.date() + timedelta(days=GENERATION_WINDOW_DAYS)

        for task_id in await self._tasks.list_recurrent_task_ids():
            node = await self._tasks.load_node(task_id)
            if node is None:
                continue
            await self._generate_occurrences(task_id, node.fields, window_end)
            await self._maybe_reset_finished(task_id, node.fields, now)

    async def _generate_occurrences(
        self, task_id: str, fields: dict, window_end: date
    ) -> None:
        anchor = date.fromisoformat(fields["recurrent_task_anchor_date"])
        generated_until = date.fromisoformat(
            fields.get(
                "recurrent_task_generated_until", (anchor - timedelta(days=1)).isoformat()
            )
        )
        if generated_until >= window_end:
            return

        unit = RecurrenceUnit(fields["recurrence_unit"])
        interval = int(fields["recurrence_interval"])
        days_of_week = [int(d) for d in fields.get("recurrence_days_of_week", "").split(",") if d]
        end_type = RecurrenceEndType(fields["recurrence_end_type"])
        end_date = (
            date.fromisoformat(fields["recurrence_end_date"])
            if fields.get("recurrence_end_date")
            else None
        )
        end_count = (
            int(fields["recurrence_end_count"]) if fields.get("recurrence_end_count") else None
        )

        start_from = generated_until + timedelta(days=1)
        dates = occurrence_dates(
            anchor,
            start_from,
            interval,
            unit,
            days_of_week,
            end_type,
            end_date,
            end_count,
            window_end,
        )

        start_time = time.fromisoformat(fields["recurrent_task_start_time"])
        duration = timedelta(minutes=int(fields["recurrent_task_duration_minutes"]))

        for occurrence_date in dates:
            start_dt = datetime.combine(occurrence_date, start_time, tzinfo=UTC)
            end_dt = start_dt + duration
            try:
                await self._intervals.create_interval(
                    IntervalCreate(task_id=task_id, start=start_dt, end=end_dt)
                )
            except (PastIntervalError, TaskNotLeafError, UnmetPrerequisiteError):
                # A same-instant-as-creation occurrence can already be
                # "past" by the time this runs; a recurrent task is always a
                # leaf with no prerequisites, so the other two are just
                # defensive -- never let one bad occurrence abort the rest.
                continue

        await self._tasks.update_fields(
            task_id, {"recurrent_task_generated_until": window_end.isoformat()}
        )

    async def _maybe_reset_finished(self, task_id: str, fields: dict, now: datetime) -> None:
        state = TaskState(fields.get("state", TaskState.backlog.value))
        if state not in (TaskState.sprint_done, TaskState.done):
            return

        intervals = await self._intervals.list_for_task(task_id)
        has_a_concluded_occurrence = any(
            (interval.end if interval.end.tzinfo else interval.end.replace(tzinfo=UTC)) <= now
            for interval in intervals
        )
        if has_a_concluded_occurrence:
            await self._tasks.update_fields(task_id, {"state": TaskState.backlog.value})

    async def create_recurrent_group(self, payload: RecurrentGroupCreate) -> TaskOut:
        task_id = str(uuid4())
        now = datetime.now(UTC)
        fields = {
            "name": payload.name,
            "description": "",
            "definition_of_done": "",
            "state": TaskState.backlog.value,
            "created_at": now.isoformat(),
            "order": str(await self._tasks.next_order()),
            "is_recurrent_group": "1",
            "recurrent_order": str(await self._tasks.next_recurrent_order()),
        }
        await self._tasks.create(task_id, fields)
        await self._tasks.add_to_recurrent_groups(task_id)
        return await self._task_service.get_task(task_id)

    async def delete_recurrent_group(self, group_id: str, delete_children: bool) -> None:
        node = await self._tasks.load_node(group_id)
        if node is None or node.fields.get("is_recurrent_group") != "1":
            raise RecurrentGroupNotFoundError(group_id)

        child_ids = await self._recurrent_children_of(group_id)
        if delete_children:
            for child_id in child_ids:
                child_node = await self._tasks.load_node(child_id)
                if child_node is not None and child_node.fields.get("is_recurrent_group") == "1":
                    # Recurse before deleting this child group itself, so its
                    # own descendants are cleaned up too.
                    await self.delete_recurrent_group(child_id, delete_children=True)
                else:
                    await self._tasks.delete(child_id)
        else:
            # Ungroup: reparent direct children up to this group's own
            # parent (or to root if it had none), rather than deleting them.
            grandparent_id = node.fields.get("recurrent_parent_id") or None
            for child_id in child_ids:
                await self._tasks.set_recurrent_parent(child_id, grandparent_id)

        await self._tasks.delete(group_id)

    async def _recurrent_children_of(self, parent_id: str) -> list[str]:
        task_ids = await self._tasks.list_recurrent_task_ids()
        group_ids = await self._tasks.list_recurrent_group_ids()
        children: list[str] = []
        for candidate_id in task_ids | group_ids:
            node = await self._tasks.load_node(candidate_id)
            if node is not None and node.fields.get("recurrent_parent_id") == parent_id:
                children.append(candidate_id)
        return children

    async def _load_all_recurrent_nodes(self) -> dict[str, TaskNode]:
        task_ids = await self._tasks.list_recurrent_task_ids()
        group_ids = await self._tasks.list_recurrent_group_ids()
        nodes: dict[str, TaskNode] = {}
        for item_id in task_ids | group_ids:
            node = await self._tasks.load_node(item_id)
            if node is not None:
                nodes[item_id] = node
        return nodes

    async def _is_recurrent_descendant(self, candidate_id: str, ancestor_id: str) -> bool:
        """True if candidate_id is ancestor_id itself, or nested somewhere
        inside its subtree (walking up candidate_id's own parent chain).
        """
        current: str | None = candidate_id
        visited: set[str] = set()
        while current is not None:
            if current == ancestor_id:
                return True
            if current in visited:
                break
            visited.add(current)
            node = await self._tasks.load_node(current)
            current = node.fields.get("recurrent_parent_id") or None if node else None
        return False

    async def move_recurrent_item(self, item_id: str, parent_id: str | None) -> TaskOut:
        """Reparents item_id under parent_id (or to root if None), within
        the recurrent-task-group hierarchy only. Only a recurrent group may
        ever be a parent here -- a plain recurrent task can't have children,
        so item_id becoming a *child* of another plain task is always
        rejected regardless of which one is dragged onto which (item 10).
        """
        item_node = await self._tasks.load_node(item_id)
        if item_node is None:
            raise TaskNotFoundError(item_id)

        if parent_id is not None:
            if parent_id == item_id:
                raise InvalidRecurrentParentError(parent_id)
            parent_node = await self._tasks.load_node(parent_id)
            if parent_node is None or parent_node.fields.get("is_recurrent_group") != "1":
                raise InvalidRecurrentParentError(parent_id)
            # A group can't be moved into its own descendant -- that would
            # create a cycle. A plain task never has descendants, so this
            # check is a no-op (and harmless) for that case.
            if await self._is_recurrent_descendant(parent_id, item_id):
                raise InvalidRecurrentParentError(parent_id)

        await self._tasks.set_recurrent_parent(item_id, parent_id)
        return await self._task_service.get_task(item_id)

    async def reorder_recurrent_item(
        self,
        item_id: str,
        after_id: str | None,
        before_id: str | None,
        order: float | None = None,
    ) -> TaskOut:
        """Same midpoint-insertion scheme as TaskService.reorder_task, but
        against the recurrent hierarchy's own `recurrent_order` sequence --
        deliberately never sharing state with the main tree's `order` (see
        RECURRENT_ORDER_SEQ_KEY's docstring).
        """
        if order is not None:
            if not await self._tasks.exists(item_id):
                raise TaskNotFoundError(item_id)
            await self._tasks.update_fields(item_id, {"recurrent_order": str(order)})
            return await self._task_service.get_task(item_id)

        nodes = await self._load_all_recurrent_nodes()
        if item_id not in nodes:
            raise TaskNotFoundError(item_id)
        if after_id is not None and after_id not in nodes:
            raise TaskNotFoundError(after_id)
        if before_id is not None and before_id not in nodes:
            raise TaskNotFoundError(before_id)

        after_order = _recurrent_order_of(nodes[after_id]) if after_id is not None else None
        before_order = _recurrent_order_of(nodes[before_id]) if before_id is not None else None

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
            await self._rebalance_recurrent_order(nodes, item_id, after_id)
        else:
            await self._tasks.update_fields(item_id, {"recurrent_order": str(candidate)})

        return await self._task_service.get_task(item_id)

    async def _rebalance_recurrent_order(
        self, nodes: dict[str, TaskNode], item_id: str, after_id: str | None
    ) -> None:
        ordered_ids = sorted(
            (tid for tid in nodes if tid != item_id),
            key=lambda tid: (_recurrent_order_of(nodes[tid]), tid),
        )
        insert_at = 0 if after_id is None else ordered_ids.index(after_id) + 1
        ordered_ids.insert(insert_at, item_id)
        for index, tid in enumerate(ordered_ids):
            await self._tasks.update_fields(tid, {"recurrent_order": str(index * ORDER_STEP)})

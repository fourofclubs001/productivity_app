import calendar
from datetime import UTC, datetime, timedelta


def _next_monday(weeks_ahead: int) -> datetime:
    """A Monday comfortably in the future (never today), so these fixed
    fixture times never collide with the "no past-dated intervals" guard
    (v02 item 8) regardless of when the test suite happens to run.
    """
    now = datetime.now(UTC).replace(tzinfo=None, microsecond=0)
    days_until_monday = (7 - now.weekday()) % 7 or 7
    return (now + timedelta(days=days_until_monday + weeks_ahead * 7)).replace(
        hour=0, minute=0, second=0
    )


def _add_months(year: int, month: int, delta: int) -> tuple[int, int]:
    total = year * 12 + (month - 1) + delta
    new_year, new_month0 = divmod(total, 12)
    return new_year, new_month0 + 1


_MONDAY = _next_monday(weeks_ahead=4)
WEEK_START = _MONDAY.date().isoformat()
NEXT_WEEK_START = (_MONDAY + timedelta(days=7)).date().isoformat()
DAY_AFTER_WEEK_START = (_MONDAY + timedelta(days=1)).date().isoformat()
START = _MONDAY + timedelta(hours=9)

# A whole calendar month, comfortably in the future, used by the
# month-granularity test below. Its start is deliberately not aligned to
# _MONDAY -- it only needs to be far enough ahead to never collide with the
# past-dated-interval guard, and to have neighboring months to probe against.
_MONTH_YEAR, _MONTH = _add_months(_MONDAY.year, _MONDAY.month, 2)
_DAYS_IN_MONTH = calendar.monthrange(_MONTH_YEAR, _MONTH)[1]
MONTH_START = f"{_MONTH_YEAR:04d}-{_MONTH:02d}-01"
_NEXT_MONTH_YEAR, _NEXT_MONTH = _add_months(_MONTH_YEAR, _MONTH, 1)
NEXT_MONTH_START = f"{_NEXT_MONTH_YEAR:04d}-{_NEXT_MONTH:02d}-01"
MONTH_MID_ANCHOR = f"{_MONTH_YEAR:04d}-{_MONTH:02d}-15"


def create_leaf(client, name="Leaf", parent_ids=None):
    response = client.post(
        "/tasks",
        json={"name": name, "definition_of_done": "d", "parent_ids": parent_ids or []},
    )
    assert response.status_code == 201
    return response.json()


def iso(dt: datetime) -> str:
    return dt.isoformat()


def create_interval(client, task_id, start, end):
    response = client.post(
        "/intervals", json={"task_id": task_id, "start": iso(start), "end": iso(end)}
    )
    assert response.status_code == 201
    return response.json()


def evaluate(client, granularity="week", anchor=WEEK_START, task_ids=None):
    params = [("granularity", granularity), ("date", anchor)]
    for task_id in task_ids or []:
        params.append(("task_ids", task_id))
    response = client.get("/evaluate/period", params=params)
    assert response.status_code == 200
    return response.json()


def test_empty_week_has_zeroed_stats(client):
    body = evaluate(client)
    assert body["period"] == {
        "period_start": WEEK_START,
        "period_end": NEXT_WEEK_START,
        "planned_hours": 0,
        "executed_hours": 0,
        "percentage": None,
        "finished_count": 0,
        "not_finished_count": 0,
    }
    assert body["by_task"] == []


async def test_single_leaf_planned_vs_executed(client, redis_client):
    task = create_leaf(client, "Write report")
    start = START
    create_interval(client, task["id"], start, start + timedelta(hours=2))

    # Simulate an hour of execution logged via the Execute view (built in an
    # earlier milestone) by writing an entry directly.
    await redis_client.hset(
        "entry:e1",
        mapping={
            "task_id": task["id"],
            "start": iso(start),
            "end": iso(start + timedelta(hours=1)),
        },
    )
    await redis_client.zadd("entries:by_start", {"e1": start.timestamp()})

    body = evaluate(client)

    assert body["period"]["planned_hours"] == 2
    assert body["period"]["executed_hours"] == 1
    assert body["period"]["percentage"] == 50.0
    assert len(body["by_task"]) == 1
    assert body["by_task"][0]["task_id"] == task["id"]
    assert body["by_task"][0]["is_leaf"] is True
    assert body["by_task"][0]["planned_hours"] == 2
    assert body["by_task"][0]["executed_hours"] == 1


async def test_node_aggregates_its_scheduled_children(client, redis_client):
    parent = create_leaf(client, "Parent goal")
    child_a = create_leaf(client, "A", parent_ids=[parent["id"]])
    child_b = create_leaf(client, "B", parent_ids=[parent["id"]])

    start = START
    create_interval(client, child_a["id"], start, start + timedelta(hours=1))
    create_interval(
        client, child_b["id"], start + timedelta(days=1), start + timedelta(days=1, hours=3)
    )

    # Mark child_a as done (as if its sprint had already been completed).
    await redis_client.hset(f"task:{child_a['id']}", "state", "done")

    body = evaluate(client)

    by_task = {stats["task_id"]: stats for stats in body["by_task"]}
    parent_stats = by_task[parent["id"]]
    assert parent_stats["is_leaf"] is False
    assert parent_stats["planned_hours"] == 4
    assert parent_stats["finished_count"] == 1
    assert parent_stats["not_finished_count"] == 1

    assert body["period"]["finished_count"] == 1
    assert body["period"]["not_finished_count"] == 1


def test_task_not_touched_this_week_is_excluded(client):
    task = create_leaf(client, "Untouched")
    start = START + timedelta(days=7)  # a different week
    create_interval(client, task["id"], start, start + timedelta(hours=1))

    body = evaluate(client)
    assert body["by_task"] == []
    assert body["period"]["planned_hours"] == 0


async def test_executed_without_a_plan_has_no_percentage(client, redis_client):
    task = create_leaf(client, "Unplanned work")
    start = START
    await redis_client.hset(
        "entry:e1",
        mapping={
            "task_id": task["id"],
            "start": iso(start),
            "end": iso(start + timedelta(hours=1)),
        },
    )
    await redis_client.zadd("entries:by_start", {"e1": start.timestamp()})

    body = evaluate(client)
    assert body["period"]["planned_hours"] == 0
    assert body["period"]["executed_hours"] == 1
    assert body["period"]["percentage"] is None
    assert body["by_task"][0]["percentage"] is None


def test_day_granularity_only_covers_that_day(client):
    task = create_leaf(client, "Daily task")
    start = START
    create_interval(client, task["id"], start, start + timedelta(hours=1))
    # Same week, different day - should not count for a single-day query.
    create_interval(
        client, task["id"], start + timedelta(days=1), start + timedelta(days=1, hours=2)
    )

    body = evaluate(client, granularity="day", anchor=WEEK_START)
    assert body["period"]["period_start"] == WEEK_START
    assert body["period"]["period_end"] == DAY_AFTER_WEEK_START
    assert body["period"]["planned_hours"] == 1


def test_month_granularity_spans_multiple_weeks(client):
    task = create_leaf(client, "Monthly task")
    early = datetime(_MONTH_YEAR, _MONTH, 2, 9, 0)  # early in the month
    late = datetime(_MONTH_YEAR, _MONTH, _DAYS_IN_MONTH - 1, 9, 0)  # late in the month
    create_interval(client, task["id"], early, early + timedelta(hours=1))
    create_interval(client, task["id"], late, late + timedelta(hours=2))
    # Just outside the month, in the following one.
    next_month_start = datetime(_NEXT_MONTH_YEAR, _NEXT_MONTH, 3, 9, 0)
    create_interval(
        client, task["id"], next_month_start, next_month_start + timedelta(hours=3)
    )

    body = evaluate(client, granularity="month", anchor=MONTH_MID_ANCHOR)
    assert body["period"]["period_start"] == MONTH_START
    assert body["period"]["period_end"] == NEXT_MONTH_START
    assert body["period"]["planned_hours"] == 3


def test_task_filter_narrows_to_selected_leaf(client):
    task_a = create_leaf(client, "A")
    task_b = create_leaf(client, "B")
    start = START
    create_interval(client, task_a["id"], start, start + timedelta(hours=1))
    create_interval(client, task_b["id"], start, start + timedelta(hours=3))

    body = evaluate(client, task_ids=[task_a["id"]])
    assert len(body["by_task"]) == 1
    assert body["by_task"][0]["task_id"] == task_a["id"]
    assert body["period"]["planned_hours"] == 1


def test_task_filter_on_a_goal_rolls_up_its_descendants(client):
    parent = create_leaf(client, "Goal")
    child_a = create_leaf(client, "A", parent_ids=[parent["id"]])
    child_b = create_leaf(client, "B", parent_ids=[parent["id"]])
    other = create_leaf(client, "Unrelated")

    start = START
    create_interval(client, child_a["id"], start, start + timedelta(hours=1))
    create_interval(client, child_b["id"], start, start + timedelta(hours=2))
    create_interval(client, other["id"], start, start + timedelta(hours=5))

    body = evaluate(client, task_ids=[parent["id"]])

    task_ids_in_result = {stats["task_id"] for stats in body["by_task"]}
    assert task_ids_in_result == {parent["id"], child_a["id"], child_b["id"]}
    assert other["id"] not in task_ids_in_result
    assert body["period"]["planned_hours"] == 3

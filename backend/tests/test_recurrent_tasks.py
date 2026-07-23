from datetime import UTC, date, datetime, time, timedelta
from uuid import uuid4

import pytest

from app.models.task import RecurrenceEndType, RecurrenceUnit, TaskState
from app.repositories.google_repository import GoogleRepository
from app.repositories.interval_repository import IntervalRepository
from app.repositories.task_repository import TaskRepository
from app.services.google_auth_service import GoogleAuthService
from app.services.google_calendar_client import FakeGoogleCalendarClient
from app.services.google_oauth_client import FakeGoogleOAuthClient
from app.services.google_sync_service import GoogleSyncService
from app.services.interval_service import IntervalService
from app.services.recurrent_task_service import RecurrentTaskService, occurrence_dates
from app.services.task_service import TaskService


@pytest.fixture
def services(redis_client):
    task_repo = TaskRepository(redis_client)
    interval_repo = IntervalRepository(redis_client)
    task_service = TaskService(task_repo)
    interval_service = IntervalService(interval_repo, task_repo, task_service)
    recurrent_task_service = RecurrentTaskService(
        redis_client, task_repo, task_service, interval_service
    )
    return {
        "task_repo": task_repo,
        "tasks": task_service,
        "intervals": interval_service,
        "recurrent_tasks": recurrent_task_service,
    }


async def seed_recurrent_task(
    services,
    anchor: date,
    unit: RecurrenceUnit,
    interval: int = 1,
    days_of_week: list[int] | None = None,
    end_type: RecurrenceEndType = RecurrenceEndType.never,
    end_date: date | None = None,
    end_count: int | None = None,
    name: str = "Recurrent task",
) -> str:
    """Seeds a recurrent task's hash fields directly, bypassing
    RecurrentTaskService.create_recurrent_task's real-`datetime.now(UTC)`-
    bound first generation call -- lets tests pick arbitrary anchors
    (including ones that would be "in the past" relative to real wall-clock
    time) and drive everything through explicit `now`/`ensure_applied(now=...)`
    values instead, mirroring test_rollover.py's `schedule()` helper.
    """
    task_repo = services["task_repo"]
    task_id = str(uuid4())
    fields = {
        "name": name,
        "description": "",
        "definition_of_done": "d",
        "state": TaskState.backlog.value,
        "created_at": datetime.now(UTC).isoformat(),
        "order": str(await task_repo.next_order()),
        "is_recurrent_task": "1",
        "recurrent_task_anchor_date": anchor.isoformat(),
        "recurrent_task_start_time": time(9, 0).isoformat(),
        "recurrent_task_duration_minutes": "60",
        "recurrence_interval": str(interval),
        "recurrence_unit": unit.value,
        "recurrence_days_of_week": ",".join(str(d) for d in (days_of_week or [])),
        "recurrence_end_type": end_type.value,
        "recurrent_task_generated_until": (anchor - timedelta(days=1)).isoformat(),
    }
    if end_date is not None:
        fields["recurrence_end_date"] = end_date.isoformat()
    if end_count is not None:
        fields["recurrence_end_count"] = str(end_count)
    await task_repo.create(task_id, fields)
    await task_repo.add_to_recurrent_tasks(task_id)
    return task_id


# ---------------------------------------------------------------------------
# occurrence_dates: pure-function unit tests, no redis involved.
# ---------------------------------------------------------------------------


def test_daily_every_day():
    anchor = date(2026, 7, 20)
    dates = occurrence_dates(
        anchor, anchor, 1, RecurrenceUnit.day, [], RecurrenceEndType.never, None, None,
        date(2026, 7, 23),
    )
    assert dates == [date(2026, 7, 20), date(2026, 7, 21), date(2026, 7, 22), date(2026, 7, 23)]


def test_daily_every_other_day():
    anchor = date(2026, 7, 20)
    dates = occurrence_dates(
        anchor, anchor, 2, RecurrenceUnit.day, [], RecurrenceEndType.never, None, None,
        date(2026, 7, 26),
    )
    assert dates == [date(2026, 7, 20), date(2026, 7, 22), date(2026, 7, 24), date(2026, 7, 26)]


def test_weekly_specific_days_single_week():
    # 2026-07-20 is a Monday.
    anchor = date(2026, 7, 20)
    dates = occurrence_dates(
        anchor, anchor, 1, RecurrenceUnit.week, [0, 2, 4], RecurrenceEndType.never, None, None,
        date(2026, 7, 26),
    )
    assert dates == [date(2026, 7, 20), date(2026, 7, 22), date(2026, 7, 24)]


def test_weekly_every_other_week():
    anchor = date(2026, 7, 20)  # Monday
    dates = occurrence_dates(
        anchor, anchor, 2, RecurrenceUnit.week, [0], RecurrenceEndType.never, None, None,
        date(2026, 8, 9),
    )
    # Week 0 (anchor's week) and week 2 (14 days later) -- week 1 skipped.
    assert dates == [date(2026, 7, 20), date(2026, 8, 3)]


def test_weekly_resuming_mid_window_stays_phase_locked():
    """A catch-up call starting from a date mid-cycle must still only
    return dates on the recurrence's real cadence, not drift onto whatever
    weekday start_from happens to fall on.
    """
    anchor = date(2026, 7, 20)  # Monday
    dates = occurrence_dates(
        anchor,
        date(2026, 7, 23),  # Thursday -- not one of the recurrence's own days
        1,
        RecurrenceUnit.week,
        [0, 2],
        RecurrenceEndType.never,
        None,
        None,
        date(2026, 7, 29),
    )
    # Week 0's Mon (07-20) and Wed (07-22) both precede start_from and are
    # excluded from materialization -- only week 1's Mon and Wed remain,
    # still on the rule's real cadence, not shifted to start_from's weekday.
    assert dates == [date(2026, 7, 27), date(2026, 7, 29)]


def test_monthly_preserves_day_of_month_across_a_clamped_month():
    # Jan 31 -> Feb (clamped to 28, 2026 not a leap year) -> Mar must be 31
    # again, not drift to 28 by cascading off the clamped Feb candidate.
    anchor = date(2026, 1, 31)
    dates = occurrence_dates(
        anchor, anchor, 1, RecurrenceUnit.month, [], RecurrenceEndType.never, None, None,
        date(2026, 4, 1),
    )
    assert dates == [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31)]


def test_yearly_every_year():
    anchor = date(2024, 2, 29)  # a leap-year Feb 29, to also exercise clamping
    dates = occurrence_dates(
        anchor, anchor, 1, RecurrenceUnit.year, [], RecurrenceEndType.never, None, None,
        date(2027, 3, 1),
    )
    # 2025 and 2026 aren't leap years -- Feb 29 clamps to Feb 28.
    assert dates == [date(2024, 2, 29), date(2025, 2, 28), date(2026, 2, 28), date(2027, 2, 28)]


def test_ends_on_date():
    anchor = date(2026, 7, 20)
    dates = occurrence_dates(
        anchor, anchor, 1, RecurrenceUnit.day, [], RecurrenceEndType.on_date, date(2026, 7, 22),
        None, date(2026, 7, 30),
    )
    assert dates == [date(2026, 7, 20), date(2026, 7, 21), date(2026, 7, 22)]


def test_ends_after_count():
    anchor = date(2026, 7, 20)
    dates = occurrence_dates(
        anchor, anchor, 1, RecurrenceUnit.day, [], RecurrenceEndType.after_count, None, 3,
        date(2026, 7, 30),
    )
    assert dates == [date(2026, 7, 20), date(2026, 7, 21), date(2026, 7, 22)]


def test_ends_after_count_respects_occurrences_already_past_start_from():
    """The count budget is spent against the whole series from the anchor,
    not just what's newly returned -- a catch-up call starting mid-series
    must not "refund" already-materialized occurrences.
    """
    anchor = date(2026, 7, 20)
    dates = occurrence_dates(
        anchor,
        date(2026, 7, 22),  # 2 occurrences (20th, 21st) already materialized
        1,
        RecurrenceUnit.day,
        [],
        RecurrenceEndType.after_count,
        None,
        3,
        date(2026, 7, 30),
    )
    assert dates == [date(2026, 7, 22)]


# ---------------------------------------------------------------------------
# RecurrentTaskService.ensure_applied: integration tests through fakeredis.
#
# Generation reuses IntervalService.create_interval for real (so M37's
# Google auto-sync applies for free -- see the test below), which enforces
# its "no past-dated intervals" guard against the *actual* wall-clock
# `datetime.now(UTC)`, not the simulated `now` passed to ensure_applied.
# So, same as test_intervals.py's WEEK_START/START fixtures, the anchor here
# must be a real future date -- never a hardcoded one, which would silently
# have its early occurrences dropped (or all of them, once "today" moves
# far enough past a fixed date) by that real-time guard.
# ---------------------------------------------------------------------------


def _future_anchor(days_ahead: int) -> date:
    return datetime.now(UTC).date() + timedelta(days=days_ahead)


async def test_ensure_applied_generates_intervals_within_the_window(services):
    anchor = _future_anchor(7)
    task_id = await seed_recurrent_task(services, anchor, RecurrenceUnit.day)

    now = datetime.combine(anchor, time(8, 0), tzinfo=UTC)
    await services["recurrent_tasks"].ensure_applied(now=now)

    intervals = await services["intervals"].list_for_task(task_id)
    assert len(intervals) == 29  # anchor through anchor+28 inclusive, daily
    assert min(i.start for i in intervals) == datetime.combine(anchor, time(9, 0), tzinfo=UTC)
    assert max(i.start for i in intervals) == datetime.combine(
        anchor + timedelta(days=28), time(9, 0), tzinfo=UTC
    )


async def test_ensure_applied_is_idempotent(services):
    anchor = _future_anchor(7)
    task_id = await seed_recurrent_task(services, anchor, RecurrenceUnit.day)

    now = datetime.combine(anchor, time(8, 0), tzinfo=UTC)
    await services["recurrent_tasks"].ensure_applied(now=now)
    await services["recurrent_tasks"].ensure_applied(now=now)

    intervals = await services["intervals"].list_for_task(task_id)
    assert len(intervals) == 29


async def test_ensure_applied_extends_the_window_on_a_later_call(services):
    anchor = _future_anchor(7)
    task_id = await seed_recurrent_task(services, anchor, RecurrenceUnit.day)

    await services["recurrent_tasks"].ensure_applied(
        now=datetime.combine(anchor, time(8, 0), tzinfo=UTC)
    )
    # A week later, the window should extend further out without duplicating
    # what's already been generated.
    later = anchor + timedelta(days=7)
    await services["recurrent_tasks"].ensure_applied(
        now=datetime.combine(later, time(8, 0), tzinfo=UTC)
    )

    intervals = await services["intervals"].list_for_task(task_id)
    assert len(intervals) == 36  # anchor through (anchor+7)+28 inclusive
    assert max(i.start for i in intervals) == datetime.combine(
        later + timedelta(days=28), time(9, 0), tzinfo=UTC
    )


def _next_weekday(start: date, weekday: int) -> date:
    days_ahead = (weekday - start.weekday()) % 7
    return start + timedelta(days=days_ahead)


async def test_biweekly_recurrence_keeps_generating_across_many_catchup_calls(services):
    """Regression test for v05 item 2: 'every 2 weeks on Friday until Dec
    31' was reported to only ever produce two occurrences total, never more,
    even once real elapsed time should have rolled the generation window
    forward past several more Fridays. No prior test exercised
    recurrence_interval > 1 through ensure_applied() across multiple calls
    (the only multi-call catch-up test used a daily interval=1 rule) --
    this drives a biweekly Friday rule through many irregular,
    non-cycle-aligned `now` advances and asserts the materialized
    occurrences always match what a single one-shot call over the same
    final window would produce, i.e. multi-call catch-up must never
    permanently lose/skip an occurrence a one-shot call would have made.
    """
    anchor = _next_weekday(_future_anchor(7), weekday=4)  # a future Friday
    end_date = anchor + timedelta(days=200)
    task_id = await seed_recurrent_task(
        services,
        anchor,
        RecurrenceUnit.week,
        interval=2,
        days_of_week=[4],
        end_type=RecurrenceEndType.on_date,
        end_date=end_date,
    )

    # Irregular, not-cycle-aligned advances (not clean multiples of 7 or the
    # 28-day generation window) spanning well over 100 days of simulated
    # real elapsed time and several recurrence periods.
    day_offsets = [0, 9, 6, 11, 23, 5, 40, 2]
    cumulative = 0
    for offset in day_offsets:
        cumulative += offset
        now = datetime.combine(anchor + timedelta(days=cumulative), time(8, 0), tzinfo=UTC)
        await services["recurrent_tasks"].ensure_applied(now=now)

    final_now = datetime.combine(anchor + timedelta(days=cumulative), time(8, 0), tzinfo=UTC)
    window_end = final_now.date() + timedelta(days=28)

    expected_dates = occurrence_dates(
        anchor,
        anchor,
        2,
        RecurrenceUnit.week,
        [4],
        RecurrenceEndType.on_date,
        end_date,
        None,
        window_end,
    )

    intervals = await services["intervals"].list_for_task(task_id)
    actual_dates = sorted(i.start.date() for i in intervals)

    assert actual_dates == expected_dates
    # Sanity: a biweekly rule over 100+ days must produce well more than 2
    # occurrences -- pins the exact symptom reported, not just "some" bug.
    assert len(actual_dates) > 2


async def test_sprint_done_resets_to_backlog_once_an_occurrence_concludes(services):
    anchor = _future_anchor(7)
    task_id = await seed_recurrent_task(services, anchor, RecurrenceUnit.day)

    await services["recurrent_tasks"].ensure_applied(
        now=datetime.combine(anchor, time(8, 0), tzinfo=UTC)
    )
    await services["task_repo"].update_fields(task_id, {"state": TaskState.sprint_done.value})

    # Still within the first occurrence's window -- not concluded yet.
    await services["recurrent_tasks"].ensure_applied(
        now=datetime.combine(anchor, time(9, 30), tzinfo=UTC)
    )
    assert (await services["tasks"].get_task(task_id)).state == TaskState.sprint_done

    # Past the first occurrence's end (09:00-10:00) -- resets automatically.
    await services["recurrent_tasks"].ensure_applied(
        now=datetime.combine(anchor, time(10, 30), tzinfo=UTC)
    )
    assert (await services["tasks"].get_task(task_id)).state == TaskState.backlog


async def test_non_finished_state_is_left_alone_by_the_reset_check(services):
    anchor = _future_anchor(7)
    task_id = await seed_recurrent_task(services, anchor, RecurrenceUnit.day)

    await services["recurrent_tasks"].ensure_applied(
        now=datetime.combine(anchor, time(12, 0), tzinfo=UTC)
    )
    # Scheduling a leaf task's first interval flips it to sprint_backlog --
    # the reset check only ever touches sprint_done/done, so it's untouched.
    assert (await services["tasks"].get_task(task_id)).state == TaskState.sprint_backlog


async def test_generated_intervals_sync_to_google_when_connected(redis_client, services):
    google_repo = GoogleRepository(redis_client)
    await google_repo.save_tokens(
        "access", "refresh", (datetime.now(UTC) + timedelta(hours=1)).isoformat()
    )
    auth_service = GoogleAuthService(
        google_repo, FakeGoogleOAuthClient(), "http://localhost/auth/google/callback"
    )
    google_sync = GoogleSyncService(auth_service, FakeGoogleCalendarClient())

    task_repo = services["task_repo"]
    interval_service = IntervalService(
        IntervalRepository(redis_client), task_repo, services["tasks"], google_sync
    )
    recurrent_task_service = RecurrentTaskService(
        redis_client, task_repo, services["tasks"], interval_service
    )

    anchor = _future_anchor(7)
    task_id = await seed_recurrent_task(
        services,
        anchor,
        RecurrenceUnit.day,
        end_type=RecurrenceEndType.after_count,
        end_count=1,
    )

    await recurrent_task_service.ensure_applied(
        now=datetime.combine(anchor, time(8, 0), tzinfo=UTC)
    )

    intervals = await interval_service.list_for_task(task_id)
    assert len(intervals) == 1
    assert intervals[0].google_event_id
    assert intervals[0].google_event_id.startswith("fake-event-")


# ---------------------------------------------------------------------------
# POST /recurrent-tasks: router-level integration test.
# ---------------------------------------------------------------------------


def test_create_recurrent_task_endpoint_generates_its_first_occurrence(client):
    start = datetime.combine(_future_anchor(7), time(9, 0), tzinfo=UTC)
    end = start + timedelta(hours=1)

    response = client.post(
        "/recurrent-tasks",
        json={
            "name": "Water plants",
            "definition_of_done": "Soil is moist",
            "start": start.isoformat(),
            "end": end.isoformat(),
            "recurrence_interval": 1,
            "recurrence_unit": "day",
            "recurrence_end_type": "never",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["is_recurrent_task"] is True
    assert body["is_leaf"] is True
    assert body["recurrence_unit"] == "day"

    # by-task listing isn't ordered (backed by a Redis set) -- check
    # membership rather than assuming index 0 is the first occurrence.
    intervals = client.get(f"/intervals/by-task/{body['id']}").json()
    starts = {datetime.fromisoformat(interval["start"]) for interval in intervals}
    assert start in starts


# ---------------------------------------------------------------------------
# Recurrent-task groups (item 7): router-level integration tests. Nesting
# has no creation-time API yet (only drag-and-drop, item 10, will set it) --
# these tests seed `recurrent_parent_id` directly via Redis to simulate an
# already-nested structure, mirroring how M48's drag feature will leave data.
# ---------------------------------------------------------------------------


def create_recurrent_group(client, name: str) -> dict:
    response = client.post("/recurrent-tasks/groups", json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()


def create_recurrent_task(client, name: str) -> dict:
    start = datetime.combine(_future_anchor(7), time(9, 0), tzinfo=UTC)
    end = start + timedelta(hours=1)
    response = client.post(
        "/recurrent-tasks",
        json={
            "name": name,
            "definition_of_done": "d",
            "start": start.isoformat(),
            "end": end.isoformat(),
            "recurrence_interval": 1,
            "recurrence_unit": "day",
            "recurrence_end_type": "never",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def set_recurrent_parent(redis_client, child_id: str, parent_id: str) -> None:
    await redis_client.hset(f"task:{child_id}", "recurrent_parent_id", parent_id)


def test_create_recurrent_group_endpoint(client):
    group = create_recurrent_group(client, "Chores")
    assert group["is_recurrent_group"] is True
    assert group["is_recurrent_task"] is False
    assert group["recurrent_parent_id"] is None


def test_delete_recurrent_group_with_no_children_just_deletes_it(client):
    group = create_recurrent_group(client, "Empty group")
    response = client.delete(f"/recurrent-tasks/groups/{group['id']}")
    assert response.status_code == 204
    assert client.get(f"/tasks/{group['id']}").status_code == 404


def test_delete_missing_recurrent_group_is_404(client):
    response = client.delete("/recurrent-tasks/groups/does-not-exist")
    assert response.status_code == 404


async def test_delete_recurrent_group_cascade_deletes_children(client, redis_client):
    group = create_recurrent_group(client, "Chores")
    child_task = create_recurrent_task(client, "Water plants")
    child_group = create_recurrent_group(client, "Subgroup")
    grandchild_task = create_recurrent_task(client, "Grandchild task")
    await set_recurrent_parent(redis_client, child_task["id"], group["id"])
    await set_recurrent_parent(redis_client, child_group["id"], group["id"])
    await set_recurrent_parent(redis_client, grandchild_task["id"], child_group["id"])

    response = client.delete(f"/recurrent-tasks/groups/{group['id']}?delete_children=true")
    assert response.status_code == 204

    assert client.get(f"/tasks/{group['id']}").status_code == 404
    assert client.get(f"/tasks/{child_task['id']}").status_code == 404
    assert client.get(f"/tasks/{child_group['id']}").status_code == 404
    assert client.get(f"/tasks/{grandchild_task['id']}").status_code == 404


async def test_delete_recurrent_group_ungroups_children_to_root(client, redis_client):
    group = create_recurrent_group(client, "Chores")
    child_task = create_recurrent_task(client, "Water plants")
    await set_recurrent_parent(redis_client, child_task["id"], group["id"])

    response = client.delete(f"/recurrent-tasks/groups/{group['id']}?delete_children=false")
    assert response.status_code == 204

    assert client.get(f"/tasks/{group['id']}").status_code == 404
    survivor = client.get(f"/tasks/{child_task['id']}").json()
    assert survivor["recurrent_parent_id"] is None


async def test_delete_recurrent_group_ungroups_children_to_its_own_parent(client, redis_client):
    grandparent = create_recurrent_group(client, "Grandparent")
    parent = create_recurrent_group(client, "Parent")
    child_task = create_recurrent_task(client, "Water plants")
    await set_recurrent_parent(redis_client, parent["id"], grandparent["id"])
    await set_recurrent_parent(redis_client, child_task["id"], parent["id"])

    response = client.delete(f"/recurrent-tasks/groups/{parent['id']}?delete_children=false")
    assert response.status_code == 204

    survivor = client.get(f"/tasks/{child_task['id']}").json()
    assert survivor["recurrent_parent_id"] == grandparent["id"]

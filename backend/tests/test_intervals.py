from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.repositories.interval_repository import IntervalRepository, interval_key


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


_MONDAY = _next_monday(weeks_ahead=4)
WEEK_START = _MONDAY.date().isoformat()
NEXT_WEEK_START = (_MONDAY + timedelta(days=7)).date().isoformat()
START = _MONDAY + timedelta(hours=9)


def create_leaf(client, name="Leaf"):
    response = client.post("/tasks", json={"name": name, "definition_of_done": "d"})
    assert response.status_code == 201
    return response.json()


def create_node_with_child(client):
    parent = create_leaf(client, "Parent")
    child = create_leaf(client, "Child")
    client.post(f"/tasks/{child['id']}/parents", json={"parent_id": parent["id"]})
    return client.get(f"/tasks/{parent['id']}").json()


def iso(dt: datetime) -> str:
    return dt.isoformat()


def create_interval(client, task_id: str, start: datetime, end: datetime) -> dict:
    response = client.post(
        "/intervals",
        json={"task_id": task_id, "start": iso(start), "end": iso(end)},
    )
    assert response.status_code == 201
    return response.json()


def test_update_interval_changes_time_within_same_week(client):
    task = create_leaf(client)
    start = START
    interval = create_interval(client, task["id"], start, start + timedelta(hours=1))

    new_start = start + timedelta(hours=3)
    response = client.patch(
        f"/intervals/{interval['id']}",
        json={"start": iso(new_start), "end": iso(new_start + timedelta(hours=1))},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["week_start"] == WEEK_START

    week = client.get("/intervals", params={"week_start": WEEK_START}).json()
    assert len(week) == 1
    assert week[0]["id"] == interval["id"]


def test_update_interval_across_week_boundary_rekeys_it(client):
    task = create_leaf(client)
    start = START
    interval = create_interval(client, task["id"], start, start + timedelta(hours=1))

    new_start = start + timedelta(days=7)
    response = client.patch(
        f"/intervals/{interval['id']}",
        json={"start": iso(new_start), "end": iso(new_start + timedelta(hours=1))},
    )
    assert response.status_code == 200
    assert response.json()["week_start"] == NEXT_WEEK_START

    old_week = client.get("/intervals", params={"week_start": WEEK_START}).json()
    assert old_week == []
    new_week = client.get("/intervals", params={"week_start": NEXT_WEEK_START}).json()
    assert len(new_week) == 1
    assert new_week[0]["id"] == interval["id"]


def test_update_interval_rejects_end_before_start(client):
    task = create_leaf(client)
    start = START
    interval = create_interval(client, task["id"], start, start + timedelta(hours=1))

    response = client.patch(
        f"/intervals/{interval['id']}",
        json={"start": iso(start), "end": iso(start - timedelta(hours=1))},
    )
    assert response.status_code == 400


async def test_update_interval_fully_past_is_locked_entirely(client, redis_client):
    task = create_leaf(client)
    past_start = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=3)
    past_end = past_start + timedelta(hours=1)
    interval_id = str(uuid4())
    await IntervalRepository(redis_client).create(interval_id, task["id"], past_start, past_end)

    response = client.patch(
        f"/intervals/{interval_id}",
        json={
            "start": iso(past_start + timedelta(minutes=5)),
            "end": iso(past_end + timedelta(minutes=5)),
        },
    )
    assert response.status_code == 400


async def test_update_interval_in_progress_locks_start_but_not_end(client, redis_client):
    task = create_leaf(client)
    now = datetime.now(UTC).replace(tzinfo=None)
    start = now - timedelta(minutes=30)
    end = now + timedelta(minutes=30)
    interval_id = str(uuid4())
    await IntervalRepository(redis_client).create(interval_id, task["id"], start, end)

    blocked = client.patch(
        f"/intervals/{interval_id}",
        json={"start": iso(start + timedelta(minutes=5)), "end": iso(end)},
    )
    assert blocked.status_code == 400

    allowed = client.patch(
        f"/intervals/{interval_id}",
        json={"start": iso(start), "end": iso(end + timedelta(hours=1))},
    )
    assert allowed.status_code == 200


async def test_delete_interval_fully_past_is_blocked(client, redis_client):
    task = create_leaf(client)
    past_start = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=3)
    past_end = past_start + timedelta(hours=1)
    interval_id = str(uuid4())
    await IntervalRepository(redis_client).create(interval_id, task["id"], past_start, past_end)

    response = client.delete(f"/intervals/{interval_id}")
    assert response.status_code == 400

    week_start = (past_start - timedelta(days=past_start.weekday())).date().isoformat()
    still_there = client.get("/intervals", params={"week_start": week_start}).json()
    assert [i["id"] for i in still_there] == [interval_id]


async def test_delete_interval_in_progress_is_blocked(client, redis_client):
    task = create_leaf(client)
    now = datetime.now(UTC).replace(tzinfo=None)
    start = now - timedelta(minutes=30)
    end = now + timedelta(minutes=30)
    interval_id = str(uuid4())
    await IntervalRepository(redis_client).create(interval_id, task["id"], start, end)

    response = client.delete(f"/intervals/{interval_id}")
    assert response.status_code == 400


def test_delete_interval_fully_future_still_succeeds(client):
    task = create_leaf(client)
    interval = create_interval(client, task["id"], START, START + timedelta(hours=1))

    response = client.delete(f"/intervals/{interval['id']}")
    assert response.status_code == 204


def test_update_interval_fully_future_stays_editable_but_not_into_the_past(client):
    task = create_leaf(client)
    interval = create_interval(client, task["id"], START, START + timedelta(hours=1))

    moved = client.patch(
        f"/intervals/{interval['id']}",
        json={"start": iso(START + timedelta(hours=2)), "end": iso(START + timedelta(hours=3))},
    )
    assert moved.status_code == 200

    past_start = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1)
    rejected = client.patch(
        f"/intervals/{interval['id']}",
        json={"start": iso(past_start), "end": iso(past_start + timedelta(hours=1))},
    )
    assert rejected.status_code == 400


def test_update_missing_interval_returns_404(client):
    start = START
    response = client.patch(
        "/intervals/does-not-exist",
        json={"start": iso(start), "end": iso(start + timedelta(hours=1))},
    )
    assert response.status_code == 404


def test_create_interval_moves_backlog_task_to_sprint_backlog(client):
    task = create_leaf(client)
    start = START
    response = client.post(
        "/intervals",
        json={
            "task_id": task["id"],
            "start": iso(start),
            "end": iso(start + timedelta(hours=1)),
        },
    )
    assert response.status_code == 201
    assert response.json()["week_start"] == WEEK_START

    task_after = client.get(f"/tasks/{task['id']}").json()
    assert task_after["state"] == "sprint_backlog"


def test_create_interval_rejects_end_before_start(client):
    task = create_leaf(client)
    start = START
    response = client.post(
        "/intervals",
        json={
            "task_id": task["id"],
            "start": iso(start),
            "end": iso(start - timedelta(hours=1)),
        },
    )
    assert response.status_code == 400


def test_create_interval_rejects_a_start_time_in_the_past(client):
    task = create_leaf(client)
    past_start = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1)
    response = client.post(
        "/intervals",
        json={
            "task_id": task["id"],
            "start": iso(past_start),
            "end": iso(past_start + timedelta(hours=1)),
        },
    )
    assert response.status_code == 400


def test_create_interval_rejects_non_leaf_task(client):
    parent = create_node_with_child(client)
    start = START
    response = client.post(
        "/intervals",
        json={
            "task_id": parent["id"],
            "start": iso(start),
            "end": iso(start + timedelta(hours=1)),
        },
    )
    assert response.status_code == 400


def test_create_interval_rejects_missing_task(client):
    start = START
    response = client.post(
        "/intervals",
        json={
            "task_id": "missing",
            "start": iso(start),
            "end": iso(start + timedelta(hours=1)),
        },
    )
    assert response.status_code == 404


def test_list_intervals_for_week(client):
    task = create_leaf(client)
    start = START
    client.post(
        "/intervals",
        json={
            "task_id": task["id"],
            "start": iso(start),
            "end": iso(start + timedelta(hours=1)),
        },
    )

    response = client.get("/intervals", params={"week_start": WEEK_START})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["task_id"] == task["id"]

    empty = client.get("/intervals", params={"week_start": NEXT_WEEK_START})
    assert empty.json() == []


def test_delete_last_interval_reverts_sprint_backlog_task_to_backlog(client):
    task = create_leaf(client)
    start = START
    interval = client.post(
        "/intervals",
        json={
            "task_id": task["id"],
            "start": iso(start),
            "end": iso(start + timedelta(hours=1)),
        },
    ).json()

    response = client.delete(f"/intervals/{interval['id']}")
    assert response.status_code == 204

    task_after = client.get(f"/tasks/{task['id']}").json()
    assert task_after["state"] == "backlog"


def test_delete_one_of_several_intervals_keeps_task_scheduled(client):
    task = create_leaf(client)
    start = START
    first = client.post(
        "/intervals",
        json={
            "task_id": task["id"],
            "start": iso(start),
            "end": iso(start + timedelta(hours=1)),
        },
    ).json()
    client.post(
        "/intervals",
        json={
            "task_id": task["id"],
            "start": iso(start + timedelta(days=1)),
            "end": iso(start + timedelta(days=1, hours=1)),
        },
    )

    client.delete(f"/intervals/{first['id']}")

    task_after = client.get(f"/tasks/{task['id']}").json()
    assert task_after["state"] == "sprint_backlog"


def test_deleting_a_task_removes_its_future_scheduled_intervals(client):
    task = create_leaf(client)
    start = START
    create_interval(client, task["id"], start, start + timedelta(hours=1))

    response = client.get("/intervals", params={"week_start": WEEK_START})
    assert len(response.json()) == 1

    client.delete(f"/tasks/{task['id']}")

    response = client.get("/intervals", params={"week_start": WEEK_START})
    assert response.json() == []


async def test_deleting_a_task_leaves_its_past_intervals_untouched(client, redis_client):
    task = create_leaf(client)

    # Seed a past-dated interval directly (bypassing IntervalService's
    # "no past-dated intervals" guard, which only applies to creation, not
    # to historical data) alongside a normal future one.
    past_start = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=1)
    past_week_start = (past_start - timedelta(days=past_start.weekday())).date().isoformat()
    past_interval_id = str(uuid4())
    await IntervalRepository(redis_client).create(
        past_interval_id,
        task["id"],
        past_start,
        past_start + timedelta(hours=1),
        task["name"],
    )

    create_interval(client, task["id"], START, START + timedelta(hours=1))

    client.delete(f"/tasks/{task['id']}")

    past_week = client.get("/intervals", params={"week_start": past_week_start}).json()
    assert [i["id"] for i in past_week] == [past_interval_id]
    # The task is gone, but the name snapshotted at creation time survives.
    assert past_week[0]["task_name"] == task["name"]

    future_week = client.get("/intervals", params={"week_start": WEEK_START}).json()
    assert future_week == []


def test_create_interval_snapshots_the_task_name(client):
    task = create_leaf(client, "Snapshot me")
    interval = create_interval(client, task["id"], START, START + timedelta(hours=1))
    assert interval["task_name"] == "Snapshot me"

    week = client.get("/intervals", params={"week_start": WEEK_START}).json()
    assert week[0]["task_name"] == "Snapshot me"


async def test_interval_created_without_a_name_snapshot_falls_back_to_none(client, redis_client):
    """Simulates a legacy interval created before this feature shipped --
    the hash simply never had a task_name field, as opposed to one storing
    an empty string."""
    task = create_leaf(client)
    interval_id = str(uuid4())
    await IntervalRepository(redis_client).create(
        interval_id, task["id"], START, START + timedelta(hours=1)
    )
    await redis_client.hdel(interval_key(interval_id), "task_name")

    week = client.get("/intervals", params={"week_start": WEEK_START}).json()
    assert week[0]["task_name"] is None


def test_create_interval_blocked_when_prerequisite_has_no_interval_yet(client):
    task = create_leaf(client, "Task")
    required = create_leaf(client, "Required")
    client.post(f"/tasks/{task['id']}/requires", json={"required_id": required["id"]})

    start = START
    response = client.post(
        "/intervals",
        json={
            "task_id": task["id"],
            "start": iso(start),
            "end": iso(start + timedelta(hours=1)),
        },
    )
    assert response.status_code == 409


def test_create_interval_blocked_when_it_would_start_before_prerequisite_ends(client):
    task = create_leaf(client, "Task")
    required = create_leaf(client, "Required")
    client.post(f"/tasks/{task['id']}/requires", json={"required_id": required["id"]})

    start = START
    create_interval(client, required["id"], start, start + timedelta(hours=2))

    response = client.post(
        "/intervals",
        json={
            "task_id": task["id"],
            "start": iso(start + timedelta(hours=1)),
            "end": iso(start + timedelta(hours=3)),
        },
    )
    assert response.status_code == 409


def test_create_interval_allowed_once_scheduled_after_prerequisites_last_interval(client):
    task = create_leaf(client, "Task")
    required = create_leaf(client, "Required")
    client.post(f"/tasks/{task['id']}/requires", json={"required_id": required["id"]})

    start = START
    create_interval(client, required["id"], start, start + timedelta(hours=1))

    response = client.post(
        "/intervals",
        json={
            "task_id": task["id"],
            "start": iso(start + timedelta(hours=1)),
            "end": iso(start + timedelta(hours=2)),
        },
    )
    assert response.status_code == 201


def test_update_interval_blocked_when_it_would_start_before_prerequisite_ends(client):
    task = create_leaf(client, "Task")
    required = create_leaf(client, "Required")
    client.post(f"/tasks/{task['id']}/requires", json={"required_id": required["id"]})

    start = START
    create_interval(client, required["id"], start, start + timedelta(hours=2))
    interval = create_interval(
        client, task["id"], start + timedelta(hours=3), start + timedelta(hours=4)
    )

    response = client.patch(
        f"/intervals/{interval['id']}",
        json={"start": iso(start), "end": iso(start + timedelta(hours=1))},
    )
    assert response.status_code == 409


async def test_delete_interval_does_not_revert_in_progress_task(client, redis_client):
    task = create_leaf(client)
    start = START
    interval = client.post(
        "/intervals",
        json={
            "task_id": task["id"],
            "start": iso(start),
            "end": iso(start + timedelta(hours=1)),
        },
    ).json()

    await redis_client.hset(f"task:{task['id']}", "state", "in_progress")

    client.delete(f"/intervals/{interval['id']}")

    task_after = client.get(f"/tasks/{task['id']}").json()
    assert task_after["state"] == "in_progress"


def test_coverage_hours_for_unscheduled_task_is_zero(client):
    task = create_leaf(client)
    response = client.get(f"/intervals/coverage/{task['id']}")
    assert response.status_code == 200
    assert response.json()["covered_hours"] == 0


def test_coverage_hours_sums_a_leaf_tasks_intervals(client):
    task = create_leaf(client)
    start = START
    create_interval(client, task["id"], start, start + timedelta(hours=1, minutes=30))
    create_interval(
        client, task["id"], start + timedelta(days=1), start + timedelta(days=1, hours=2)
    )

    response = client.get(f"/intervals/coverage/{task['id']}")
    assert response.json()["covered_hours"] == 3.5


def test_coverage_hours_aggregates_across_leaf_descendants(client):
    parent = create_leaf(client, "Parent")
    child_a = create_leaf(client, "A")
    child_b = create_leaf(client, "B")
    client.post(f"/tasks/{child_a['id']}/parents", json={"parent_id": parent["id"]})
    client.post(f"/tasks/{child_b['id']}/parents", json={"parent_id": parent["id"]})

    start = START
    create_interval(client, child_a["id"], start, start + timedelta(hours=1))
    create_interval(client, child_b["id"], start, start + timedelta(hours=2))

    response = client.get(f"/intervals/coverage/{parent['id']}")
    assert response.json()["covered_hours"] == 3


def test_coverage_hours_missing_task_returns_404(client):
    response = client.get("/intervals/coverage/does-not-exist")
    assert response.status_code == 404

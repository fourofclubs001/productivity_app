from datetime import datetime, timedelta

WEEK_START = "2026-07-13"


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


def test_empty_week_has_zeroed_stats(client):
    response = client.get("/evaluate/week", params={"week_start": WEEK_START})
    assert response.status_code == 200
    body = response.json()
    assert body["week"] == {
        "week_start": WEEK_START,
        "planned_hours": 0,
        "executed_hours": 0,
        "percentage": None,
        "finished_count": 0,
        "not_finished_count": 0,
    }
    assert body["by_task"] == []


async def test_single_leaf_planned_vs_executed(client, redis_client):
    task = create_leaf(client, "Write report")
    start = datetime(2026, 7, 13, 9, 0)
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

    response = client.get("/evaluate/week", params={"week_start": WEEK_START})
    body = response.json()

    assert body["week"]["planned_hours"] == 2
    assert body["week"]["executed_hours"] == 1
    assert body["week"]["percentage"] == 50.0
    assert len(body["by_task"]) == 1
    assert body["by_task"][0]["task_id"] == task["id"]
    assert body["by_task"][0]["is_leaf"] is True
    assert body["by_task"][0]["planned_hours"] == 2
    assert body["by_task"][0]["executed_hours"] == 1


async def test_node_aggregates_its_scheduled_children(client, redis_client):
    parent = create_leaf(client, "Parent goal")
    child_a = create_leaf(client, "A", parent_ids=[parent["id"]])
    child_b = create_leaf(client, "B", parent_ids=[parent["id"]])

    start = datetime(2026, 7, 13, 9, 0)
    create_interval(client, child_a["id"], start, start + timedelta(hours=1))
    create_interval(
        client, child_b["id"], start + timedelta(days=1), start + timedelta(days=1, hours=3)
    )

    # Mark child_a as done (as if its sprint had already been completed).
    await redis_client.hset(f"task:{child_a['id']}", "state", "done")

    response = client.get("/evaluate/week", params={"week_start": WEEK_START})
    body = response.json()

    by_task = {stats["task_id"]: stats for stats in body["by_task"]}
    parent_stats = by_task[parent["id"]]
    assert parent_stats["is_leaf"] is False
    assert parent_stats["planned_hours"] == 4
    assert parent_stats["finished_count"] == 1
    assert parent_stats["not_finished_count"] == 1

    assert body["week"]["finished_count"] == 1
    assert body["week"]["not_finished_count"] == 1


def test_task_not_touched_this_week_is_excluded(client):
    task = create_leaf(client, "Untouched")
    start = datetime(2026, 7, 20, 9, 0)  # a different week
    create_interval(client, task["id"], start, start + timedelta(hours=1))

    response = client.get("/evaluate/week", params={"week_start": WEEK_START})
    body = response.json()
    assert body["by_task"] == []
    assert body["week"]["planned_hours"] == 0


async def test_executed_without_a_plan_has_no_percentage(client, redis_client):
    task = create_leaf(client, "Unplanned work")
    start = datetime(2026, 7, 13, 9, 0)
    await redis_client.hset(
        "entry:e1",
        mapping={
            "task_id": task["id"],
            "start": iso(start),
            "end": iso(start + timedelta(hours=1)),
        },
    )
    await redis_client.zadd("entries:by_start", {"e1": start.timestamp()})

    response = client.get("/evaluate/week", params={"week_start": WEEK_START})
    body = response.json()
    assert body["week"]["planned_hours"] == 0
    assert body["week"]["executed_hours"] == 1
    assert body["week"]["percentage"] is None
    assert body["by_task"][0]["percentage"] is None

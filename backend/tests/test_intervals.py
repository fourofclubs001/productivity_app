from datetime import datetime, timedelta


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


def test_create_interval_moves_backlog_task_to_sprint_backlog(client):
    task = create_leaf(client)
    start = datetime(2026, 7, 13, 9, 0)
    response = client.post(
        "/intervals",
        json={
            "task_id": task["id"],
            "start": iso(start),
            "end": iso(start + timedelta(hours=1)),
        },
    )
    assert response.status_code == 201
    assert response.json()["week_start"] == "2026-07-13"

    task_after = client.get(f"/tasks/{task['id']}").json()
    assert task_after["state"] == "sprint_backlog"


def test_create_interval_rejects_end_before_start(client):
    task = create_leaf(client)
    start = datetime(2026, 7, 13, 9, 0)
    response = client.post(
        "/intervals",
        json={
            "task_id": task["id"],
            "start": iso(start),
            "end": iso(start - timedelta(hours=1)),
        },
    )
    assert response.status_code == 400


def test_create_interval_rejects_non_leaf_task(client):
    parent = create_node_with_child(client)
    start = datetime(2026, 7, 13, 9, 0)
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
    start = datetime(2026, 7, 13, 9, 0)
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
    start = datetime(2026, 7, 13, 9, 0)
    client.post(
        "/intervals",
        json={
            "task_id": task["id"],
            "start": iso(start),
            "end": iso(start + timedelta(hours=1)),
        },
    )

    response = client.get("/intervals", params={"week_start": "2026-07-13"})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["task_id"] == task["id"]

    empty = client.get("/intervals", params={"week_start": "2026-07-20"})
    assert empty.json() == []


def test_delete_last_interval_reverts_sprint_backlog_task_to_backlog(client):
    task = create_leaf(client)
    start = datetime(2026, 7, 13, 9, 0)
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
    start = datetime(2026, 7, 13, 9, 0)
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


def test_deleting_a_task_removes_its_scheduled_intervals(client):
    task = create_leaf(client)
    start = datetime(2026, 7, 13, 9, 0)
    create_interval(client, task["id"], start, start + timedelta(hours=1))

    response = client.get("/intervals", params={"week_start": "2026-07-13"})
    assert len(response.json()) == 1

    client.delete(f"/tasks/{task['id']}")

    response = client.get("/intervals", params={"week_start": "2026-07-13"})
    assert response.json() == []


async def test_delete_interval_does_not_revert_in_progress_task(client, redis_client):
    task = create_leaf(client)
    start = datetime(2026, 7, 13, 9, 0)
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

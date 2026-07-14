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


def test_update_interval_changes_time_within_same_week(client):
    task = create_leaf(client)
    start = datetime(2026, 7, 13, 9, 0)
    interval = create_interval(client, task["id"], start, start + timedelta(hours=1))

    new_start = start + timedelta(hours=3)
    response = client.patch(
        f"/intervals/{interval['id']}",
        json={"start": iso(new_start), "end": iso(new_start + timedelta(hours=1))},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["week_start"] == "2026-07-13"

    week = client.get("/intervals", params={"week_start": "2026-07-13"}).json()
    assert len(week) == 1
    assert week[0]["id"] == interval["id"]


def test_update_interval_across_week_boundary_rekeys_it(client):
    task = create_leaf(client)
    start = datetime(2026, 7, 13, 9, 0)
    interval = create_interval(client, task["id"], start, start + timedelta(hours=1))

    new_start = start + timedelta(days=7)
    response = client.patch(
        f"/intervals/{interval['id']}",
        json={"start": iso(new_start), "end": iso(new_start + timedelta(hours=1))},
    )
    assert response.status_code == 200
    assert response.json()["week_start"] == "2026-07-20"

    old_week = client.get("/intervals", params={"week_start": "2026-07-13"}).json()
    assert old_week == []
    new_week = client.get("/intervals", params={"week_start": "2026-07-20"}).json()
    assert len(new_week) == 1
    assert new_week[0]["id"] == interval["id"]


def test_update_interval_rejects_end_before_start(client):
    task = create_leaf(client)
    start = datetime(2026, 7, 13, 9, 0)
    interval = create_interval(client, task["id"], start, start + timedelta(hours=1))

    response = client.patch(
        f"/intervals/{interval['id']}",
        json={"start": iso(start), "end": iso(start - timedelta(hours=1))},
    )
    assert response.status_code == 400


def test_update_missing_interval_returns_404(client):
    start = datetime(2026, 7, 13, 9, 0)
    response = client.patch(
        "/intervals/does-not-exist",
        json={"start": iso(start), "end": iso(start + timedelta(hours=1))},
    )
    assert response.status_code == 404


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


def test_create_interval_blocked_when_prerequisite_has_no_interval_yet(client):
    task = create_leaf(client, "Task")
    required = create_leaf(client, "Required")
    client.post(f"/tasks/{task['id']}/requires", json={"required_id": required["id"]})

    start = datetime(2026, 7, 13, 9, 0)
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

    start = datetime(2026, 7, 13, 9, 0)
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

    start = datetime(2026, 7, 13, 9, 0)
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

    start = datetime(2026, 7, 13, 9, 0)
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


def test_coverage_hours_for_unscheduled_task_is_zero(client):
    task = create_leaf(client)
    response = client.get(f"/intervals/coverage/{task['id']}")
    assert response.status_code == 200
    assert response.json()["covered_hours"] == 0


def test_coverage_hours_sums_a_leaf_tasks_intervals(client):
    task = create_leaf(client)
    start = datetime(2026, 7, 13, 9, 0)
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

    start = datetime(2026, 7, 13, 9, 0)
    create_interval(client, child_a["id"], start, start + timedelta(hours=1))
    create_interval(client, child_b["id"], start, start + timedelta(hours=2))

    response = client.get(f"/intervals/coverage/{parent['id']}")
    assert response.json()["covered_hours"] == 3


def test_coverage_hours_missing_task_returns_404(client):
    response = client.get("/intervals/coverage/does-not-exist")
    assert response.status_code == 404

def create_leaf(client, name="Leaf"):
    response = client.post("/tasks", json={"name": name, "definition_of_done": "d"})
    assert response.status_code == 201
    return response.json()


def create_node_with_child(client):
    parent = create_leaf(client, "Parent")
    child = create_leaf(client, "Child")
    client.post(f"/tasks/{child['id']}/parents", json={"parent_id": parent["id"]})
    return client.get(f"/tasks/{parent['id']}").json()


def test_active_timer_is_null_when_nothing_running(client):
    response = client.get("/timer/active")
    assert response.status_code == 200
    assert response.json() is None


def test_start_timer_sets_task_in_progress(client):
    task = create_leaf(client)
    response = client.post("/timer/start", json={"task_id": task["id"]})
    assert response.status_code == 200
    body = response.json()
    assert body["task_id"] == task["id"]
    assert body["end"] is None

    task_after = client.get(f"/tasks/{task['id']}").json()
    assert task_after["state"] == "in_progress"

    active = client.get("/timer/active").json()
    assert active["id"] == body["id"]


def test_start_timer_rejects_non_leaf_task(client):
    parent = create_node_with_child(client)
    response = client.post("/timer/start", json={"task_id": parent["id"]})
    assert response.status_code == 400


def test_start_timer_rejects_missing_task(client):
    response = client.post("/timer/start", json={"task_id": "missing"})
    assert response.status_code == 404


def test_start_timer_blocked_while_a_prerequisite_is_not_sprint_done(client):
    task = create_leaf(client, "Task")
    required = create_leaf(client, "Required")
    client.post(f"/tasks/{task['id']}/requires", json={"required_id": required["id"]})

    response = client.post("/timer/start", json={"task_id": task["id"]})
    assert response.status_code == 409

    task_after = client.get(f"/tasks/{task['id']}").json()
    assert task_after["state"] == "backlog"


def test_start_timer_allowed_once_prerequisite_is_sprint_done(client):
    task = create_leaf(client, "Task")
    required = create_leaf(client, "Required")
    client.post(f"/tasks/{task['id']}/requires", json={"required_id": required["id"]})

    client.post("/timer/start", json={"task_id": required["id"]})
    client.post("/timer/stop")
    client.post("/timer/mark-done", json={"task_id": required["id"]})

    response = client.post("/timer/start", json={"task_id": task["id"]})
    assert response.status_code == 200


def test_starting_a_new_timer_stops_the_previous_one(client):
    first = create_leaf(client, "First")
    second = create_leaf(client, "Second")

    client.post("/timer/start", json={"task_id": first["id"]})
    response = client.post("/timer/start", json={"task_id": second["id"]})
    assert response.status_code == 200

    active = client.get("/timer/active").json()
    assert active["task_id"] == second["id"]

    # The first task's timer was stopped but it was never marked done, so it
    # stays in_progress rather than reverting anywhere.
    first_after = client.get(f"/tasks/{first['id']}").json()
    assert first_after["state"] == "in_progress"


def test_stop_timer_ends_the_entry_without_touching_task_state(client):
    task = create_leaf(client)
    client.post("/timer/start", json={"task_id": task["id"]})

    response = client.post("/timer/stop")
    assert response.status_code == 200
    assert response.json()["end"] is not None

    task_after = client.get(f"/tasks/{task['id']}").json()
    assert task_after["state"] == "in_progress"

    assert client.get("/timer/active").json() is None


def test_stop_timer_without_active_timer_fails(client):
    response = client.post("/timer/stop")
    assert response.status_code == 400


def test_mark_done_transitions_in_progress_task_to_sprint_done(client):
    task = create_leaf(client)
    client.post("/timer/start", json={"task_id": task["id"]})
    client.post("/timer/stop")

    response = client.post("/timer/mark-done", json={"task_id": task["id"]})
    assert response.status_code == 200
    assert response.json()["state"] == "sprint_done"

    task_after = client.get(f"/tasks/{task['id']}").json()
    assert task_after["state"] == "sprint_done"


def test_mark_done_rejects_a_task_that_is_not_in_progress(client):
    task = create_leaf(client)
    response = client.post("/timer/mark-done", json={"task_id": task["id"]})
    assert response.status_code == 400


def test_mark_done_rejects_missing_task(client):
    response = client.post("/timer/mark-done", json={"task_id": "missing"})
    assert response.status_code == 404


def test_revert_done_undoes_a_sprint_done_transition(client):
    task = create_leaf(client)
    client.post("/timer/start", json={"task_id": task["id"]})
    client.post("/timer/stop")
    client.post("/timer/mark-done", json={"task_id": task["id"]})

    response = client.post("/timer/revert-done", json={"task_id": task["id"]})
    assert response.status_code == 200
    assert response.json()["state"] == "in_progress"

    task_after = client.get(f"/tasks/{task['id']}").json()
    assert task_after["state"] == "in_progress"


def test_revert_done_rejects_a_task_that_is_not_sprint_done(client):
    task = create_leaf(client)
    client.post("/timer/start", json={"task_id": task["id"]})

    response = client.post("/timer/revert-done", json={"task_id": task["id"]})
    assert response.status_code == 400


def test_revert_done_rejects_missing_task(client):
    response = client.post("/timer/revert-done", json={"task_id": "missing"})
    assert response.status_code == 404


def test_list_entries_for_week(client):
    task = create_leaf(client)
    client.post("/timer/start", json={"task_id": task["id"]})
    client.post("/timer/stop")

    import datetime

    # Entries are timestamped in UTC (see TimerService), so "this week" must be
    # computed from the UTC date, not the local machine date, to avoid flaking
    # near a UTC day/week boundary.
    today_utc = datetime.datetime.now(datetime.UTC).date()
    this_week_start = (today_utc - datetime.timedelta(days=today_utc.weekday())).isoformat()
    response = client.get("/entries", params={"week_start": this_week_start})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["task_id"] == task["id"]


def test_deleting_a_task_with_a_running_timer_is_blocked(client):
    task = create_leaf(client)
    client.post("/timer/start", json={"task_id": task["id"]})

    response = client.delete(f"/tasks/{task['id']}")
    assert response.status_code == 409
    assert "timer" in response.json()["detail"].lower()

    # The task must still exist.
    assert client.get(f"/tasks/{task['id']}").status_code == 200


def test_deleting_a_task_after_stopping_its_timer_succeeds(client):
    task = create_leaf(client)
    client.post("/timer/start", json={"task_id": task["id"]})
    client.post("/timer/stop")

    response = client.delete(f"/tasks/{task['id']}")
    assert response.status_code == 204


def test_deleting_a_task_while_a_different_tasks_timer_runs_is_unaffected(client):
    tracked = create_leaf(client, "Tracked")
    other = create_leaf(client, "Other")
    client.post("/timer/start", json={"task_id": tracked["id"]})

    response = client.delete(f"/tasks/{other['id']}")
    assert response.status_code == 204

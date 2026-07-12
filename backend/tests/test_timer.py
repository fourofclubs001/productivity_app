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


def test_stop_timer_marking_done_sets_sprint_done(client):
    task = create_leaf(client)
    client.post("/timer/start", json={"task_id": task["id"]})

    response = client.post("/timer/stop", json={"mark_done": True})
    assert response.status_code == 200
    assert response.json()["end"] is not None

    task_after = client.get(f"/tasks/{task['id']}").json()
    assert task_after["state"] == "sprint_done"

    assert client.get("/timer/active").json() is None


def test_stop_timer_without_marking_done_stays_in_progress(client):
    task = create_leaf(client)
    client.post("/timer/start", json={"task_id": task["id"]})

    client.post("/timer/stop", json={"mark_done": False})

    task_after = client.get(f"/tasks/{task['id']}").json()
    assert task_after["state"] == "in_progress"


def test_stop_timer_without_active_timer_fails(client):
    response = client.post("/timer/stop", json={"mark_done": True})
    assert response.status_code == 400


def test_list_entries_for_week(client):
    task = create_leaf(client)
    client.post("/timer/start", json={"task_id": task["id"]})
    client.post("/timer/stop", json={"mark_done": True})

    import datetime

    this_week_start = (
        datetime.date.today() - datetime.timedelta(days=datetime.date.today().weekday())
    ).isoformat()
    response = client.get("/entries", params={"week_start": this_week_start})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["task_id"] == task["id"]

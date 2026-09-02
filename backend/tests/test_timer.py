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
    assert body["task_name"] == task["name"]

    task_after = client.get(f"/tasks/{task['id']}").json()
    assert task_after["state"] == "in_progress"

    active = client.get("/timer/active").json()
    assert active["id"] == body["id"]
    assert active["task_name"] == task["name"]


def test_entry_keeps_its_snapshotted_task_name_after_the_task_is_deleted(client):
    task = create_leaf(client, "Doomed leaf")
    start_response = client.post("/timer/start", json={"task_id": task["id"]})
    entry_id = start_response.json()["id"]
    client.post("/timer/stop")

    client.delete(f"/tasks/{task['id']}")

    week_start = client.get("/entries", params={"week_start": "2020-01-06"}).json()
    assert week_start == []  # sanity: wrong week returns nothing, not an error

    entries = client.get(
        "/entries",
        params={
            "week_start": start_response.json()["start"][:10],
        },
    ).json()
    matching = [e for e in entries if e["id"] == entry_id]
    assert len(matching) == 1
    assert matching[0]["task_name"] == "Doomed leaf"


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


def test_mark_subtree_done_on_a_single_leaf_is_a_no_op_subtree_of_itself(client):
    task = create_leaf(client)
    response = client.post("/timer/mark-subtree-done", json={"task_id": task["id"]})
    assert response.status_code == 200
    assert response.json() == [task["id"]]

    task_after = client.get(f"/tasks/{task['id']}").json()
    assert task_after["state"] == "sprint_done"


def test_mark_subtree_done_forces_backlog_leaves_done_bypassing_in_progress_precondition(client):
    goal = create_leaf(client, "Goal")
    leaf_a = create_leaf(client, "Leaf A")
    leaf_b = create_leaf(client, "Leaf B")
    client.post(f"/tasks/{leaf_a['id']}/parents", json={"parent_id": goal["id"]})
    client.post(f"/tasks/{leaf_b['id']}/parents", json={"parent_id": goal["id"]})
    # Both leaves start in backlog -- mark_done alone would reject this.
    assert client.get(f"/tasks/{leaf_a['id']}").json()["state"] == "backlog"

    response = client.post("/timer/mark-subtree-done", json={"task_id": goal["id"]})
    assert response.status_code == 200
    assert set(response.json()) == {leaf_a["id"], leaf_b["id"]}

    assert client.get(f"/tasks/{leaf_a['id']}").json()["state"] == "sprint_done"
    assert client.get(f"/tasks/{leaf_b['id']}").json()["state"] == "sprint_done"


def test_mark_subtree_done_only_returns_leaves_actually_changed(client):
    goal = create_leaf(client, "Goal")
    already_done = create_leaf(client, "Already done")
    still_backlog = create_leaf(client, "Still backlog")
    client.post(f"/tasks/{already_done['id']}/parents", json={"parent_id": goal["id"]})
    client.post(f"/tasks/{still_backlog['id']}/parents", json={"parent_id": goal["id"]})
    client.post("/timer/start", json={"task_id": already_done["id"]})
    client.post("/timer/stop")
    client.post("/timer/mark-done", json={"task_id": already_done["id"]})

    response = client.post("/timer/mark-subtree-done", json={"task_id": goal["id"]})
    assert response.status_code == 200
    assert response.json() == [still_backlog["id"]]


def test_mark_subtree_done_leaves_the_single_task_mark_done_precondition_unchanged(client):
    # Confirms the bulk endpoint's bypass doesn't leak into mark-done itself.
    task = create_leaf(client)
    response = client.post("/timer/mark-done", json={"task_id": task["id"]})
    assert response.status_code == 400


def test_mark_subtree_done_rejects_missing_task(client):
    response = client.post("/timer/mark-subtree-done", json={"task_id": "missing"})
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


def test_create_historical_entry_records_tracked_time_without_touching_the_timer(client):
    task = create_leaf(client, "Manual entry")
    response = client.post(
        "/entries",
        json={
            "task_id": task["id"],
            "start": "2020-01-01T09:00:00+00:00",
            "end": "2020-01-01T10:30:00+00:00",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["task_id"] == task["id"]
    assert body["task_name"] == "Manual entry"
    assert body["end"] is not None
    # No active timer was started.
    assert client.get("/timer/active").json() is None


def test_create_entry_rejects_end_before_start_and_missing_task(client):
    task = create_leaf(client)
    bad = client.post(
        "/entries",
        json={
            "task_id": task["id"],
            "start": "2020-01-01T10:00:00+00:00",
            "end": "2020-01-01T09:00:00+00:00",
        },
    )
    assert bad.status_code == 400
    missing = client.post(
        "/entries",
        json={
            "task_id": "nope",
            "start": "2020-01-01T09:00:00+00:00",
            "end": "2020-01-01T10:00:00+00:00",
        },
    )
    assert missing.status_code == 404


def test_update_entry_changes_start_and_end_and_reindexes_by_start(client):
    task = create_leaf(client)
    created = client.post(
        "/entries",
        json={
            "task_id": task["id"],
            "start": "2021-06-07T09:00:00+00:00",
            "end": "2021-06-07T10:00:00+00:00",
        },
    ).json()

    response = client.patch(
        f"/entries/{created['id']}",
        json={"start": "2021-06-07T08:15:00+00:00", "end": "2021-06-07T09:45:00+00:00"},
    )
    assert response.status_code == 200
    assert response.json()["start"] == "2021-06-07T08:15:00Z"

    week = client.get("/entries", params={"week_start": "2021-06-07"}).json()
    assert len(week) == 1
    assert week[0]["start"] == "2021-06-07T08:15:00Z"


def test_update_entry_rejects_end_before_start_and_missing_entry(client):
    task = create_leaf(client)
    created = client.post(
        "/entries",
        json={
            "task_id": task["id"],
            "start": "2021-06-07T09:00:00+00:00",
            "end": "2021-06-07T10:00:00+00:00",
        },
    ).json()
    bad = client.patch(f"/entries/{created['id']}", json={"end": "2021-06-07T08:00:00+00:00"})
    assert bad.status_code == 400
    missing = client.patch("/entries/nope", json={"start": "2021-06-07T09:00:00+00:00"})
    assert missing.status_code == 404


def test_cannot_edit_the_running_entrys_end(client):
    task = create_leaf(client)
    entry_id = client.post("/timer/start", json={"task_id": task["id"]}).json()["id"]
    response = client.patch(f"/entries/{entry_id}", json={"end": "2099-01-01T00:00:00+00:00"})
    assert response.status_code == 400
    assert "running timer" in response.json()["detail"].lower()


def test_list_entries_for_a_task_returns_only_that_tasks_entries_sorted_by_start(client):
    task_a = create_leaf(client, "A")
    task_b = create_leaf(client, "B")
    for task, start in [(task_b, "09:00"), (task_a, "11:00"), (task_a, "08:00")]:
        client.post(
            "/entries",
            json={
                "task_id": task["id"],
                "start": f"2021-06-07T{start}:00+00:00",
                "end": f"2021-06-07T{start[:2]}:30:00+00:00",
            },
        )
    rows = client.get(f"/entries/by-task/{task_a['id']}").json()
    assert [r["start"] for r in rows] == ["2021-06-07T08:00:00Z", "2021-06-07T11:00:00Z"]


def test_delete_entry_removes_it_from_the_week_list(client):
    task = create_leaf(client)
    created = client.post(
        "/entries",
        json={
            "task_id": task["id"],
            "start": "2021-06-07T09:00:00+00:00",
            "end": "2021-06-07T10:00:00+00:00",
        },
    ).json()
    assert client.delete(f"/entries/{created['id']}").status_code == 204
    assert client.get("/entries", params={"week_start": "2021-06-07"}).json() == []
    assert client.delete(f"/entries/{created['id']}").status_code == 404


def test_deleting_the_active_entry_clears_the_running_timer(client):
    task = create_leaf(client)
    entry_id = client.post("/timer/start", json={"task_id": task["id"]}).json()["id"]
    assert client.delete(f"/entries/{entry_id}").status_code == 204
    assert client.get("/timer/active").json() is None


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

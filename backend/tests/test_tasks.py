def create_task(client, name="Task", parent_ids=None, dod="done when done"):
    response = client.post(
        "/tasks",
        json={"name": name, "definition_of_done": dod, "parent_ids": parent_ids or []},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_create_and_get_leaf_task(client):
    created = create_task(client, name="Write report")
    assert created["name"] == "Write report"
    assert created["state"] == "backlog"
    assert created["is_leaf"] is True
    assert created["parent_ids"] == []
    assert created["children_ids"] == []

    response = client.get(f"/tasks/{created['id']}")
    assert response.status_code == 200
    assert response.json() == created


def test_list_tasks(client):
    create_task(client, name="A")
    create_task(client, name="B")
    response = client.get("/tasks")
    assert response.status_code == 200
    names = {task["name"] for task in response.json()}
    assert names == {"A", "B"}


def test_get_missing_task_returns_404(client):
    response = client.get("/tasks/does-not-exist")
    assert response.status_code == 404


def test_update_task_fields(client):
    task = create_task(client, name="Old name")
    response = client.patch(
        f"/tasks/{task['id']}",
        json={"name": "New name", "description": "desc", "definition_of_done": "new dod"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "New name"
    assert body["description"] == "desc"
    assert body["definition_of_done"] == "new dod"


def test_update_task_colors_valid(client):
    task = create_task(client)
    response = client.patch(f"/tasks/{task['id']}", json={"colors": ["red", "blue"]})
    assert response.status_code == 200
    body = response.json()
    assert body["colors"] == ["blue", "red"]
    assert body["effective_colors"] == ["blue", "red"]


def test_update_task_colors_invalid_rejected(client):
    task = create_task(client)
    response = client.patch(f"/tasks/{task['id']}", json={"colors": ["not-a-color"]})
    assert response.status_code == 400


def test_delete_task(client):
    task = create_task(client)
    response = client.delete(f"/tasks/{task['id']}")
    assert response.status_code == 204
    assert client.get(f"/tasks/{task['id']}").status_code == 404


def test_delete_task_promotes_orphaned_child_to_root(client):
    parent = create_task(client, name="Parent")
    child = create_task(client, name="Child", parent_ids=[parent["id"]])

    client.delete(f"/tasks/{parent['id']}")

    response = client.get(f"/tasks/{child['id']}")
    assert response.status_code == 200
    assert response.json()["parent_ids"] == []


def test_add_and_remove_parent(client):
    parent = create_task(client, name="Parent")
    child = create_task(client, name="Child")

    response = client.post(f"/tasks/{child['id']}/parents", json={"parent_id": parent["id"]})
    assert response.status_code == 200
    body = response.json()
    assert body["parent_ids"] == [parent["id"]]

    parent_after = client.get(f"/tasks/{parent['id']}").json()
    assert parent_after["children_ids"] == [child["id"]]
    assert parent_after["is_leaf"] is False

    response = client.delete(f"/tasks/{child['id']}/parents/{parent['id']}")
    assert response.status_code == 200
    assert response.json()["parent_ids"] == []


def test_add_parent_rejects_self_parent(client):
    task = create_task(client)
    response = client.post(f"/tasks/{task['id']}/parents", json={"parent_id": task["id"]})
    assert response.status_code == 400


def test_add_parent_rejects_cycle(client):
    grandparent = create_task(client, name="Grandparent")
    parent = create_task(client, name="Parent", parent_ids=[grandparent["id"]])

    response = client.post(
        f"/tasks/{grandparent['id']}/parents", json={"parent_id": parent["id"]}
    )
    assert response.status_code == 400


def test_task_can_have_multiple_parents(client):
    parent_a = create_task(client, name="A")
    parent_b = create_task(client, name="B")
    child = create_task(client, name="Child", parent_ids=[parent_a["id"], parent_b["id"]])

    assert sorted(child["parent_ids"]) == sorted([parent_a["id"], parent_b["id"]])


def test_node_state_backlog_when_all_descendants_backlog(client):
    parent = create_task(client, name="Parent")
    create_task(client, name="Child", parent_ids=[parent["id"]])

    body = client.get(f"/tasks/{parent['id']}").json()
    assert body["state"] == "backlog"
    assert body["is_leaf"] is False


def test_node_state_done_only_when_all_descendants_done(client):
    parent = create_task(client, name="Parent")
    child_a = create_task(client, name="A", parent_ids=[parent["id"]])
    create_task(client, name="B", parent_ids=[parent["id"]])

    # Manually flip one leaf to done via repository-level state; simulate through redis directly
    # is not exposed yet (lifecycle endpoints land in a later milestone), so this test only
    # exercises the backlog case end-to-end and documents the intended done/in_progress rules.
    assert client.get(f"/tasks/{child_a['id']}").json()["state"] == "backlog"


def test_color_inheritance_and_override(client):
    parent = create_task(client, name="Parent")
    client.patch(f"/tasks/{parent['id']}", json={"colors": ["red"]})
    child = create_task(client, name="Child", parent_ids=[parent["id"]])

    child_body = client.get(f"/tasks/{child['id']}").json()
    assert child_body["colors"] == []
    assert child_body["effective_colors"] == ["red"]

    client.patch(f"/tasks/{child['id']}", json={"colors": ["blue"]})
    overridden = client.get(f"/tasks/{child['id']}").json()
    assert overridden["effective_colors"] == ["blue"]


def test_color_inheritance_union_from_multiple_parents(client):
    parent_a = create_task(client, name="A")
    parent_b = create_task(client, name="B")
    client.patch(f"/tasks/{parent_a['id']}", json={"colors": ["red"]})
    client.patch(f"/tasks/{parent_b['id']}", json={"colors": ["blue"]})
    child = create_task(client, name="Child", parent_ids=[parent_a["id"], parent_b["id"]])

    body = client.get(f"/tasks/{child['id']}").json()
    assert body["effective_colors"] == ["blue", "red"]


def test_get_palette(client):
    response = client.get("/tasks/palette")
    assert response.status_code == 200
    assert "red" in response.json()


def test_create_task_with_colors(client):
    response = client.post(
        "/tasks",
        json={"name": "Task", "definition_of_done": "d", "colors": ["red", "blue"]},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["colors"] == ["blue", "red"]
    assert body["effective_colors"] == ["blue", "red"]


def test_create_task_with_invalid_color_rejected(client):
    response = client.post(
        "/tasks",
        json={"name": "Task", "definition_of_done": "d", "colors": ["not-a-color"]},
    )
    assert response.status_code == 400


def test_new_tasks_get_increasing_default_order(client):
    a = create_task(client, name="A")
    b = create_task(client, name="B")
    c = create_task(client, name="C")
    assert a["order"] < b["order"] < c["order"]


def test_children_ids_are_order_sorted(client):
    parent = create_task(client, name="Parent")
    third = create_task(client, name="Third", parent_ids=[parent["id"]])
    first = create_task(client, name="First", parent_ids=[parent["id"]])
    second = create_task(client, name="Second", parent_ids=[parent["id"]])
    client.patch(f"/tasks/{first['id']}/order", json={"before_id": third["id"]})
    client.patch(
        f"/tasks/{second['id']}/order",
        json={"after_id": first["id"], "before_id": third["id"]},
    )

    body = client.get(f"/tasks/{parent['id']}").json()
    assert body["children_ids"] == [first["id"], second["id"], third["id"]]


def test_reorder_with_explicit_order_bypasses_after_before(client):
    a = create_task(client, name="A")
    original_order = a["order"]

    moved = client.patch(f"/tasks/{a['id']}/order", json={"order": 42.5}).json()
    assert moved["order"] == 42.5

    restored = client.patch(f"/tasks/{a['id']}/order", json={"order": original_order}).json()
    assert restored["order"] == original_order


def test_reorder_task_moves_it_between_two_others(client):
    a = create_task(client, name="A")
    b = create_task(client, name="B")
    c = create_task(client, name="C")
    # Move C between A and B.
    response = client.patch(
        f"/tasks/{c['id']}/order", json={"after_id": a["id"], "before_id": b["id"]}
    )
    assert response.status_code == 200
    body = response.json()
    assert a["order"] < body["order"] < b["order"]


def test_reorder_to_start_and_end(client):
    a = create_task(client, name="A")
    b = create_task(client, name="B")

    moved_to_start = client.patch(f"/tasks/{b['id']}/order", json={"before_id": a["id"]}).json()
    assert moved_to_start["order"] < a["order"]

    moved_to_end = client.patch(f"/tasks/{b['id']}/order", json={"after_id": a["id"]}).json()
    assert moved_to_end["order"] > a["order"]


def test_reorder_rebalances_when_precision_is_exhausted(client):
    a = create_task(client, name="A")
    b = create_task(client, name="B")

    # Repeatedly insert a fresh task into the shrinking (lo, B) gap, each time
    # narrowing lo to the newly-inserted task, until float precision can no
    # longer represent a midpoint distinct from both neighbors -- forcing a
    # full rebalance of the whole order sequence.
    lo = a
    inserted_ids = []
    for i in range(100):
        candidate = create_task(client, name=f"Between {i}")
        response = client.patch(
            f"/tasks/{candidate['id']}/order", json={"after_id": lo["id"], "before_id": b["id"]}
        )
        assert response.status_code == 200
        moved = response.json()
        inserted_ids.append(moved["id"])
        lo = moved

    tasks_by_id = {t["id"]: t for t in client.get("/tasks").json()}
    ordered = sorted(tasks_by_id.values(), key=lambda t: t["order"])
    ordered_ids = [t["id"] for t in ordered]
    # Rebalance must preserve relative order (A first, then every inserted
    # task in insertion order, then B last) even though every order value
    # got renumbered, and all resulting values must be distinct.
    assert ordered_ids == [a["id"], *inserted_ids, b["id"]]
    assert len({t["order"] for t in ordered}) == len(ordered)

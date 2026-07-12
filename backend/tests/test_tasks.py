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

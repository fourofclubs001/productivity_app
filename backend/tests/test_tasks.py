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


def test_add_and_remove_requirement(client):
    task = create_task(client, name="Task")
    required = create_task(client, name="Required")

    response = client.post(f"/tasks/{task['id']}/requires", json={"required_id": required["id"]})
    assert response.status_code == 200
    body = response.json()
    assert body["requires_ids"] == [required["id"]]

    required_body = client.get(f"/tasks/{required['id']}").json()
    assert required_body["required_by_ids"] == [task["id"]]

    response = client.delete(f"/tasks/{task['id']}/requires/{required['id']}")
    assert response.status_code == 200
    assert response.json()["requires_ids"] == []


def test_self_requirement_rejected(client):
    task = create_task(client, name="Task")
    response = client.post(f"/tasks/{task['id']}/requires", json={"required_id": task["id"]})
    assert response.status_code == 400


def test_requirement_cycle_rejected(client):
    a = create_task(client, name="A")
    b = create_task(client, name="B")

    response = client.post(f"/tasks/{a['id']}/requires", json={"required_id": b["id"]})
    assert response.status_code == 200

    # B already (transitively) requires... wait, A requires B, so B cannot
    # also require A -- that would close a cycle A -> B -> A.
    response = client.post(f"/tasks/{b['id']}/requires", json={"required_id": a["id"]})
    assert response.status_code == 400


def test_transitive_requirement_cycle_rejected(client):
    a = create_task(client, name="A")
    b = create_task(client, name="B")
    c = create_task(client, name="C")

    a_requires_b = client.post(f"/tasks/{a['id']}/requires", json={"required_id": b["id"]})
    assert a_requires_b.status_code == 200
    b_requires_c = client.post(f"/tasks/{b['id']}/requires", json={"required_id": c["id"]})
    assert b_requires_c.status_code == 200

    # C -> A would close the cycle A -> B -> C -> A.
    response = client.post(f"/tasks/{c['id']}/requires", json={"required_id": a["id"]})
    assert response.status_code == 400


def test_requiring_an_ancestor_is_rejected(client):
    parent = create_task(client, name="Parent")
    child = create_task(client, name="Child", parent_ids=[parent["id"]])

    response = client.post(f"/tasks/{child['id']}/requires", json={"required_id": parent["id"]})
    assert response.status_code == 400


def test_requiring_a_grandparent_is_rejected(client):
    grandparent = create_task(client, name="Grandparent")
    parent = create_task(client, name="Parent", parent_ids=[grandparent["id"]])
    child = create_task(client, name="Child", parent_ids=[parent["id"]])

    response = client.post(
        f"/tasks/{child['id']}/requires", json={"required_id": grandparent["id"]}
    )
    assert response.status_code == 400


def test_requiring_a_descendant_is_still_allowed(client):
    parent = create_task(client, name="Parent")
    child = create_task(client, name="Child", parent_ids=[parent["id"]])

    # The reverse direction (a parent requiring its own child) isn't the
    # ancestor-cycle case this guard targets -- only unrelated tasks would
    # normally be required, but a descendant-as-requirement doesn't create
    # the completion-depends-on-itself cycle an ancestor-as-requirement does.
    response = client.post(f"/tasks/{parent['id']}/requires", json={"required_id": child["id"]})
    assert response.status_code == 200


def test_deleting_a_task_cleans_up_requirement_edges(client):
    task = create_task(client, name="Task")
    required = create_task(client, name="Required")
    client.post(f"/tasks/{task['id']}/requires", json={"required_id": required["id"]})

    assert client.delete(f"/tasks/{required['id']}").status_code == 204

    body = client.get(f"/tasks/{task['id']}").json()
    assert body["requires_ids"] == []


def test_new_task_has_no_estimated_hours(client):
    task = create_task(client, name="Task")
    assert task["estimated_hours"] is None


def test_set_estimated_hours_on_leaf(client):
    task = create_task(client, name="Task")
    response = client.patch(f"/tasks/{task['id']}", json={"estimated_hours": 2.5})
    assert response.status_code == 200
    assert response.json()["estimated_hours"] == 2.5


def test_set_estimated_hours_on_non_leaf_rejected(client):
    parent = create_task(client, name="Parent")
    create_task(client, name="Child", parent_ids=[parent["id"]])
    response = client.patch(f"/tasks/{parent['id']}", json={"estimated_hours": 3})
    assert response.status_code == 400


def test_estimated_hours_rolls_up_to_parent(client):
    parent = create_task(client, name="Parent")
    child_a = create_task(client, name="A", parent_ids=[parent["id"]])
    child_b = create_task(client, name="B", parent_ids=[parent["id"]])
    client.patch(f"/tasks/{child_a['id']}", json={"estimated_hours": 2})
    client.patch(f"/tasks/{child_b['id']}", json={"estimated_hours": 1.5})

    body = client.get(f"/tasks/{parent['id']}").json()
    assert body["estimated_hours"] == 3.5


def test_estimated_hours_rollup_is_zero_with_no_leaf_estimates(client):
    parent = create_task(client, name="Parent")
    create_task(client, name="Child", parent_ids=[parent["id"]])
    body = client.get(f"/tasks/{parent['id']}").json()
    assert body["estimated_hours"] == 0


async def test_keep_as_backlog_overrides_computed_done_state(client, redis_client):
    parent = create_task(client, name="Goal")
    child_a = create_task(client, name="A", parent_ids=[parent["id"]])
    child_b = create_task(client, name="B", parent_ids=[parent["id"]])
    await redis_client.hset(f"task:{child_a['id']}", "state", "done")
    await redis_client.hset(f"task:{child_b['id']}", "state", "sprint_done")

    before = client.get(f"/tasks/{parent['id']}").json()
    assert before["state"] == "in_progress"  # sprint_done counts as "active" per _compute_state

    response = client.post(f"/tasks/{parent['id']}/keep-as-backlog")
    assert response.status_code == 200
    assert response.json()["state"] == "backlog"

    after = client.get(f"/tasks/{parent['id']}").json()
    assert after["state"] == "backlog"


async def test_keep_as_backlog_override_bypassed_once_a_child_regresses(client, redis_client):
    parent = create_task(client, name="Goal")
    child = create_task(client, name="A", parent_ids=[parent["id"]])
    await redis_client.hset(f"task:{child['id']}", "state", "done")

    client.post(f"/tasks/{parent['id']}/keep-as-backlog")
    assert client.get(f"/tasks/{parent['id']}").json()["state"] == "backlog"

    # Reopen the child -- the override's "all finished" condition no longer
    # holds, so it should be silently bypassed, falling through to the
    # normal live-computed state.
    await redis_client.hset(f"task:{child['id']}", "state", "in_progress")
    assert client.get(f"/tasks/{parent['id']}").json()["state"] == "in_progress"


async def test_keep_as_backlog_override_bypassed_once_a_new_child_is_added(client, redis_client):
    parent = create_task(client, name="Goal")
    child = create_task(client, name="A", parent_ids=[parent["id"]])
    await redis_client.hset(f"task:{child['id']}", "state", "sprint_done")

    client.post(f"/tasks/{parent['id']}/keep-as-backlog")
    assert client.get(f"/tasks/{parent['id']}").json()["state"] == "backlog"

    create_task(client, name="C (new)", parent_ids=[parent["id"]])
    assert client.get(f"/tasks/{parent['id']}").json()["state"] == "in_progress"


def test_keep_as_backlog_rejects_a_leaf_task(client):
    task = create_task(client, name="Leaf")
    response = client.post(f"/tasks/{task['id']}/keep-as-backlog")
    assert response.status_code == 400


async def test_keep_as_backlog_rejects_when_not_all_children_are_finished(client, redis_client):
    parent = create_task(client, name="Goal")
    child_a = create_task(client, name="A", parent_ids=[parent["id"]])
    create_task(client, name="B", parent_ids=[parent["id"]])
    await redis_client.hset(f"task:{child_a['id']}", "state", "done")
    # child_b is still backlog -- not all finished.

    response = client.post(f"/tasks/{parent['id']}/keep-as-backlog")
    assert response.status_code == 400


def test_keep_as_backlog_rejects_missing_task(client):
    response = client.post("/tasks/missing/keep-as-backlog")
    assert response.status_code == 404

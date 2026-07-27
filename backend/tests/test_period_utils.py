from app.repositories.task_repository import TaskNode
from app.services.period_utils import (
    expand_task_selection,
    main_tree_descendant_leaves,
    recurrent_ancestors,
    recurrent_descendant_tasks,
)


def node(task_id: str, fields: dict | None = None, children: set[str] | None = None) -> TaskNode:
    return TaskNode(id=task_id, fields=fields or {}, children=children or set())


def test_main_tree_descendant_leaves_collects_only_leaves():
    graph = {
        "goal": node("goal", children={"a", "sub"}),
        "sub": node("sub", children={"b"}),
        "a": node("a"),
        "b": node("b"),
    }
    assert main_tree_descendant_leaves("goal", graph) == {"a", "b"}


def test_recurrent_descendant_tasks_ignores_main_tree_children():
    graph = {
        "group": node("group", fields={"is_recurrent_group": "1"}),
        "task_a": node("task_a", fields={"is_recurrent_task": "1", "recurrent_parent_id": "group"}),
        "plain": node("plain"),
    }
    assert recurrent_descendant_tasks("group", graph) == {"task_a"}
    # A plain task (no recurrent_parent_id pointing at it) has no recurrent
    # descendants, regardless of main-tree children -- the two hierarchies
    # are entirely independent.
    assert recurrent_descendant_tasks("plain", graph) == set()


def test_recurrent_descendant_tasks_expands_through_nested_subgroups():
    graph = {
        "top": node("top", fields={"is_recurrent_group": "1"}),
        "sub": node("sub", fields={"is_recurrent_group": "1", "recurrent_parent_id": "top"}),
        "task_a": node("task_a", fields={"is_recurrent_task": "1", "recurrent_parent_id": "sub"}),
    }
    assert recurrent_descendant_tasks("top", graph) == {"task_a"}


def test_recurrent_ancestors_climbs_through_nested_subgroups():
    graph = {
        "top": node("top", fields={"is_recurrent_group": "1"}),
        "sub": node("sub", fields={"is_recurrent_group": "1", "recurrent_parent_id": "top"}),
        "task_a": node("task_a", fields={"is_recurrent_task": "1", "recurrent_parent_id": "sub"}),
    }
    assert recurrent_ancestors("task_a", graph) == ["sub", "top"]


def test_recurrent_ancestors_is_empty_for_a_main_tree_task():
    graph = {"plain": node("plain")}
    assert recurrent_ancestors("plain", graph) == []


def test_expand_task_selection_combines_both_hierarchies_independently():
    graph = {
        "goal": node("goal", children={"leaf_a"}),
        "leaf_a": node("leaf_a"),
        "group": node("group", fields={"is_recurrent_group": "1"}),
        "task_b": node("task_b", fields={"is_recurrent_task": "1", "recurrent_parent_id": "group"}),
        "other": node("other"),
    }
    selected = expand_task_selection(["goal", "group"], graph)
    assert selected == {"goal", "leaf_a", "group", "task_b"}
    assert "other" not in selected


def test_expand_task_selection_keeps_an_id_not_in_the_graph_unexpanded():
    selected = expand_task_selection(["missing"], {})
    assert selected == {"missing"}

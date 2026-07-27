from collections import defaultdict
from datetime import date, timedelta
from enum import Enum

from app.repositories.interval_repository import monday_of
from app.repositories.task_repository import TaskNode


class Granularity(str, Enum):
    day = "day"
    week = "week"
    month = "month"


def period_bounds(granularity: Granularity, anchor: date) -> tuple[date, date]:
    """Returns [start, end) for the period containing `anchor`, end exclusive."""
    if granularity == Granularity.day:
        return anchor, anchor + timedelta(days=1)
    if granularity == Granularity.week:
        start = monday_of(anchor)
        return start, start + timedelta(days=7)

    start = anchor.replace(day=1)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


def main_tree_descendant_leaves(task_id: str, graph: dict[str, TaskNode]) -> set[str]:
    """Every leaf reachable from `task_id` via the main tree's children_ids
    edges -- selecting a "goal" in a task filter rolls up to these.
    """
    result: set[str] = set()
    stack = list(graph[task_id].children)
    while stack:
        current = stack.pop()
        if current in result:
            continue
        node = graph[current]
        if not node.children:
            result.add(current)
        else:
            stack.extend(node.children)
    return result


def _recurrent_children_map(graph: dict[str, TaskNode]) -> dict[str, list[str]]:
    children: dict[str, list[str]] = defaultdict(list)
    for node in graph.values():
        parent_id = node.fields.get("recurrent_parent_id")
        if parent_id:
            children[parent_id].append(node.id)
    return children


def recurrent_descendant_tasks(
    group_id: str,
    graph: dict[str, TaskNode],
    recurrent_children: dict[str, list[str]] | None = None,
) -> set[str]:
    """Every recurrent *task* (not group) reachable from `group_id` via the
    separate `recurrent_parent_id` hierarchy (nested subgroups expand too) --
    selecting a recurrent group in a task filter rolls up to these, mirroring
    `main_tree_descendant_leaves` above for a main-tree goal. This hierarchy
    is entirely untouched by the main tree's children_ids, so a recurrent
    group always has an empty `graph[group_id].children` regardless of how
    many recurrent tasks nest under it.
    """
    if recurrent_children is not None:
        children_map = recurrent_children
    else:
        children_map = _recurrent_children_map(graph)
    result: set[str] = set()
    stack = list(children_map.get(group_id, []))
    while stack:
        current = stack.pop()
        if current in result:
            continue
        node = graph.get(current)
        if node and node.fields.get("is_recurrent_group") == "1":
            stack.extend(children_map.get(current, []))
        else:
            result.add(current)
    return result


def recurrent_ancestors(leaf_id: str, graph: dict[str, TaskNode]) -> list[str]:
    """Climbs `recurrent_parent_id` from a recurrent task up through any
    nesting of recurrent groups. Recurrent tasks have no main-tree parents
    (they're organizationally separate, never reparented into the main
    tree), so this is the only way a recurrent group ever gets its own
    aggregated row in a by-task breakdown.
    """
    ancestors: list[str] = []
    node = graph.get(leaf_id)
    parent_id = node.fields.get("recurrent_parent_id") if node else None
    while parent_id:
        ancestors.append(parent_id)
        parent_node = graph.get(parent_id)
        parent_id = parent_node.fields.get("recurrent_parent_id") if parent_node else None
    return ancestors


def expand_task_selection(task_ids: list[str], graph: dict[str, TaskNode]) -> set[str]:
    """Expands a set of selected task ids (from a filter dropdown) into
    every id it should match: the task itself, plus -- if it's in the
    graph -- its main-tree descendant leaves (a selected "goal" rolls up)
    and its recurrent-task descendants (a selected recurrent group rolls
    up). The two expansions are independent and safe to run unconditionally
    for any task_id: a plain task has no recurrent descendants, and a
    recurrent group has no main-tree descendants.
    """
    recurrent_children = _recurrent_children_map(graph)
    selected: set[str] = set()
    for task_id in task_ids:
        selected.add(task_id)
        if task_id in graph:
            selected |= main_tree_descendant_leaves(task_id, graph)
            selected |= recurrent_descendant_tasks(task_id, graph, recurrent_children)
    return selected

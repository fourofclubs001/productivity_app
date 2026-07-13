from collections.abc import Callable, Iterable

from app.repositories.task_repository import TaskNode


def is_reachable(start_id: str, target_id: str, get_edges: Callable[[str], Iterable[str]]) -> bool:
    """Whether target_id can be reached from start_id by following get_edges(node).

    Generic DFS reachability check, decoupled from any particular edge shape
    (used for both the parent/child DAG's cycle guard and the prerequisite
    dependency graph's cycle guard).
    """
    visited: set[str] = set()
    stack = [start_id]
    while stack:
        current = stack.pop()
        if current == target_id:
            return True
        if current in visited:
            continue
        visited.add(current)
        stack.extend(get_edges(current))
    return False


def leaf_descendants(task_id: str, graph: dict[str, TaskNode]) -> set[str]:
    """task_id itself if it's a leaf, else every leaf beneath it in the DAG.

    Shared by task_service (estimated-hours rollup) and interval_service
    (coverage-hours aggregation), which both need "which leaves count toward
    this task" for either a leaf or a goal/parent task.
    """
    node = graph[task_id]
    if not node.children:
        return {task_id}

    leaves: set[str] = set()
    visited: set[str] = set()
    stack = [task_id]
    while stack:
        current = stack.pop()
        if current in visited:
            continue
        visited.add(current)
        current_node = graph[current]
        if not current_node.children:
            leaves.add(current)
        else:
            stack.extend(current_node.children)
    return leaves

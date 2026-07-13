from collections.abc import Callable, Iterable


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

class TaskNotFoundError(Exception):
    def __init__(self, task_id: str) -> None:
        self.task_id = task_id
        super().__init__(f"Task {task_id!r} not found")


class CycleError(Exception):
    def __init__(self, task_id: str, parent_id: str) -> None:
        self.task_id = task_id
        self.parent_id = parent_id
        super().__init__(f"Adding {parent_id!r} as a parent of {task_id!r} would create a cycle")


class SelfParentError(Exception):
    def __init__(self, task_id: str) -> None:
        self.task_id = task_id
        super().__init__(f"Task {task_id!r} cannot be its own parent")


class InvalidColorError(Exception):
    def __init__(self, colors: list[str]) -> None:
        self.colors = colors
        super().__init__(f"Invalid colors: {colors}")

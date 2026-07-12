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


class TaskNotLeafError(Exception):
    def __init__(self, task_id: str) -> None:
        self.task_id = task_id
        super().__init__(f"Task {task_id!r} is not a leaf task and cannot be scheduled")


class InvalidIntervalError(Exception):
    def __init__(self) -> None:
        super().__init__("Interval end must be after start")


class IntervalNotFoundError(Exception):
    def __init__(self, interval_id: str) -> None:
        self.interval_id = interval_id
        super().__init__(f"Interval {interval_id!r} not found")


class NoActiveTimerError(Exception):
    def __init__(self) -> None:
        super().__init__("No timer is currently running")

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


class RequirementCycleError(Exception):
    def __init__(self, task_id: str, required_id: str) -> None:
        self.task_id = task_id
        self.required_id = required_id
        super().__init__(
            f"Requiring {required_id!r} for {task_id!r} would create a cycle of prerequisites"
        )


class SelfRequirementError(Exception):
    def __init__(self, task_id: str) -> None:
        self.task_id = task_id
        super().__init__(f"Task {task_id!r} cannot require itself")


class UnmetPrerequisiteError(Exception):
    def __init__(self, task_id: str, unmet_ids: list[str]) -> None:
        self.task_id = task_id
        self.unmet_ids = unmet_ids
        super().__init__(
            f"Task {task_id!r} cannot be scheduled until its prerequisites are done: {unmet_ids}"
        )


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


class TaskNotInProgressError(Exception):
    def __init__(self, task_id: str) -> None:
        self.task_id = task_id
        super().__init__(f"Task {task_id!r} is not in progress and cannot be marked done")


class TaskNotSprintDoneError(Exception):
    def __init__(self, task_id: str) -> None:
        self.task_id = task_id
        super().__init__(f"Task {task_id!r} is not sprint-done and cannot be reverted")

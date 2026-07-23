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
            f"Task {task_id!r} cannot be scheduled until its prerequisites are "
            f"scheduled before it: {unmet_ids}"
        )


class PrerequisiteNotSprintDoneError(Exception):
    def __init__(self, task_id: str, unmet_ids: list[str]) -> None:
        self.task_id = task_id
        self.unmet_ids = unmet_ids
        super().__init__(
            f"Task {task_id!r} cannot be time-tracked until its prerequisites are "
            f"sprint-done: {unmet_ids}"
        )


class RequirementAncestorError(Exception):
    def __init__(self, task_id: str, required_id: str) -> None:
        self.task_id = task_id
        self.required_id = required_id
        super().__init__(
            f"Task {task_id!r} cannot require {required_id!r} because it is one of its ancestors"
        )


class InvalidColorError(Exception):
    def __init__(self, colors: list[str]) -> None:
        self.colors = colors
        super().__init__(f"Invalid colors: {colors}")


class TaskNotLeafError(Exception):
    def __init__(self, task_id: str) -> None:
        self.task_id = task_id
        super().__init__(f"Task {task_id!r} is not a leaf task and cannot be scheduled")


class TaskNotEligibleForBacklogOverrideError(Exception):
    def __init__(self, task_id: str) -> None:
        self.task_id = task_id
        super().__init__(
            f"Task {task_id!r} can only be kept as backlog once all of its sub-tasks are "
            "sprint-done or done"
        )


class InvalidIntervalError(Exception):
    def __init__(self) -> None:
        super().__init__("Interval end must be after start")


class PastIntervalError(Exception):
    def __init__(self) -> None:
        super().__init__("A task can only be scheduled for a time after the current time")


class IntervalLockedError(Exception):
    def __init__(self) -> None:
        super().__init__(
            "This time slot has already started or ended and can no longer be edited that way"
        )


class IntervalDeleteLockedError(Exception):
    def __init__(self) -> None:
        super().__init__(
            "This time slot has already started or ended and can no longer be deleted"
        )


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


class ExcuseSelectionRequiredError(Exception):
    def __init__(self) -> None:
        super().__init__("Provide exactly one of excuse_id or new_excuse_text")


class ExcuseNotFoundError(Exception):
    def __init__(self, excuse_id: str) -> None:
        self.excuse_id = excuse_id
        super().__init__(f"Excuse {excuse_id!r} not found")


class FutureGapExcuseError(Exception):
    def __init__(self) -> None:
        super().__init__("A future gap can't be explained -- it hasn't happened yet")


class GoogleAuthError(Exception):
    def __init__(self) -> None:
        super().__init__("Google OAuth state is invalid or has expired")


class GoogleNotConnectedError(Exception):
    def __init__(self) -> None:
        super().__init__("Google Calendar is not connected")


class IntervalAlreadySyncedError(Exception):
    def __init__(self, interval_id: str) -> None:
        self.interval_id = interval_id
        super().__init__(f"Interval {interval_id!r} is already synced to Google Calendar")


class GoogleSyncFailedError(Exception):
    def __init__(self) -> None:
        super().__init__("Could not reach Google Calendar to sync this event")


class RecurrentGroupNotFoundError(Exception):
    def __init__(self, group_id: str) -> None:
        self.group_id = group_id
        super().__init__(f"Recurrent group {group_id!r} not found")

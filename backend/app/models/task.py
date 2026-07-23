from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field

PALETTE: list[str] = [
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "pink",
    "gray",
    "forest",
    "indigo",
    "magenta",
]


class TaskState(str, Enum):
    backlog = "backlog"
    sprint_backlog = "sprint_backlog"
    in_progress = "in_progress"
    sprint_done = "sprint_done"
    done = "done"


class RecurrenceUnit(str, Enum):
    day = "day"
    week = "week"
    month = "month"
    year = "year"


class RecurrenceEndType(str, Enum):
    never = "never"
    on_date = "on_date"
    after_count = "after_count"


class TaskCreate(BaseModel):
    name: str = Field(min_length=1)
    definition_of_done: str = Field(min_length=1)
    description: str = ""
    parent_ids: list[str] = Field(default_factory=list)
    colors: list[str] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    definition_of_done: str | None = None
    colors: list[str] | None = None
    estimated_hours: float | None = None


class AddParentRequest(BaseModel):
    parent_id: str


class AddRequirementRequest(BaseModel):
    required_id: str


class RecurrentTaskCreate(BaseModel):
    name: str = Field(min_length=1)
    definition_of_done: str = Field(min_length=1)
    colors: list[str] = Field(default_factory=list)
    # Template for every generated occurrence: date+time of the first one,
    # duration derived from (end - start).
    start: datetime
    end: datetime
    recurrence_interval: int = Field(ge=1)
    recurrence_unit: RecurrenceUnit
    # Only meaningful when recurrence_unit == week; empty means "the
    # anchor's own weekday".
    recurrence_days_of_week: list[int] = Field(default_factory=list)
    recurrence_end_type: RecurrenceEndType
    recurrence_end_date: date | None = None
    recurrence_end_count: int | None = None


class ReorderRequest(BaseModel):
    after_id: str | None = None
    before_id: str | None = None
    # Set an exact order value directly, bypassing the after/before midpoint
    # logic. Used to restore a task to its precise prior position on undo,
    # where after/before-relative replay could land on a different value.
    order: float | None = None


class TaskOut(BaseModel):
    id: str
    name: str
    description: str
    definition_of_done: str
    state: TaskState
    created_at: datetime
    colors: list[str]
    effective_colors: list[str]
    is_leaf: bool
    parent_ids: list[str]
    children_ids: list[str]
    order: float
    requires_ids: list[str]
    required_by_ids: list[str]
    # Leaf: its own value if set, else None. Parent: sum of leaf descendants'
    # values (0 if none of them have anything set).
    estimated_hours: float | None
    # Monotonic: true once this task has ever had a child, even if it was
    # later emptied out entirely by deleting its last child outright (as
    # opposed to a task that never had children at all). Keeps it reading
    # as a goal (is_leaf: false) rather than reverting to a leaf.
    ever_had_children: bool
    # A recurrent task's recurrence rule -- None/empty for a non-recurrent task.
    is_recurrent_task: bool
    recurrence_interval: int | None = None
    recurrence_unit: RecurrenceUnit | None = None
    recurrence_days_of_week: list[int] = Field(default_factory=list)
    recurrence_end_type: RecurrenceEndType | None = None
    recurrence_end_date: date | None = None
    recurrence_end_count: int | None = None

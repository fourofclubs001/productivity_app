from datetime import datetime
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


class AddParentRequest(BaseModel):
    parent_id: str


class AddRequirementRequest(BaseModel):
    required_id: str


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

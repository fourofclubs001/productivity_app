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

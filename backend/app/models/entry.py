from datetime import datetime

from pydantic import BaseModel


class StartTimerRequest(BaseModel):
    task_id: str


class StopTimerRequest(BaseModel):
    mark_done: bool


class EntryOut(BaseModel):
    id: str
    task_id: str
    start: datetime
    end: datetime | None

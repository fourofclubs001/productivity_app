from datetime import datetime

from pydantic import BaseModel


class StartTimerRequest(BaseModel):
    task_id: str


class MarkDoneRequest(BaseModel):
    task_id: str


class EntryOut(BaseModel):
    id: str
    task_id: str
    start: datetime
    end: datetime | None
    task_name: str | None = None

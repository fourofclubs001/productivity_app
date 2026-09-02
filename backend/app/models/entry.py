from datetime import datetime

from pydantic import BaseModel


class StartTimerRequest(BaseModel):
    task_id: str


class MarkDoneRequest(BaseModel):
    task_id: str


class EntryCreate(BaseModel):
    task_id: str
    start: datetime
    end: datetime


class EntryUpdate(BaseModel):
    start: datetime | None = None
    end: datetime | None = None


class EntryOut(BaseModel):
    id: str
    task_id: str
    start: datetime
    end: datetime | None
    task_name: str | None = None

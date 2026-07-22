from datetime import datetime

from pydantic import BaseModel


class IntervalCreate(BaseModel):
    task_id: str
    start: datetime
    end: datetime


class IntervalUpdate(BaseModel):
    start: datetime
    end: datetime


class IntervalOut(BaseModel):
    id: str
    task_id: str
    start: datetime
    end: datetime
    week_start: str
    task_name: str | None = None
    google_event_id: str | None = None

from datetime import datetime

from pydantic import BaseModel


class IntervalCreate(BaseModel):
    task_id: str
    start: datetime
    end: datetime


class IntervalOut(BaseModel):
    id: str
    task_id: str
    start: datetime
    end: datetime
    week_start: str

from datetime import datetime

from pydantic import BaseModel


class AttachExcuseRequest(BaseModel):
    task_id: str
    interval_id: str | None = None
    start: datetime
    end: datetime
    excuse_id: str | None = None
    new_excuse_text: str | None = None


class ExcuseOut(BaseModel):
    id: str
    text: str


class ExcuseAttachmentOut(BaseModel):
    id: str
    excuse_id: str
    excuse_text: str
    task_id: str
    interval_id: str | None
    start: datetime
    end: datetime


class ExcuseFrequencyRow(BaseModel):
    excuse_id: str
    excuse_text: str
    count: int


class ExcuseFrequencyByTask(BaseModel):
    task_id: str
    task_name: str
    excuse_id: str
    excuse_text: str
    count: int


class ExcuseFrequencyResult(BaseModel):
    period_start: str
    period_end: str
    totals: list[ExcuseFrequencyRow]
    by_task: list[ExcuseFrequencyByTask]

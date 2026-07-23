from datetime import datetime

from pydantic import BaseModel


class GoogleConnectionStatusOut(BaseModel):
    connected: bool


class GoogleEventOut(BaseModel):
    id: str
    title: str
    start: datetime
    end: datetime

from pydantic import BaseModel


class GoogleConnectionStatusOut(BaseModel):
    connected: bool

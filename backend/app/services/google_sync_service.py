from datetime import datetime

from app.models.google import GoogleEventOut
from app.services.google_auth_service import GoogleAuthService
from app.services.google_calendar_client import GoogleCalendarClient


class GoogleSyncService:
    """Best-effort bridge from a local Interval to a Google Calendar event.

    Every method here swallows calendar-API failures and returns/no-ops
    rather than raising -- a Google outage must never block local
    scheduling. Callers that need to surface a failure to the user (the
    manual "push this one now" action) check the return value themselves;
    the automatic go-forward sync path just accepts a silent no-op.
    """

    def __init__(
        self, auth_service: GoogleAuthService, calendar_client: GoogleCalendarClient
    ) -> None:
        self._auth = auth_service
        self._calendar = calendar_client

    async def is_connected(self) -> bool:
        return (await self._auth.get_status()).connected

    async def push_interval(self, task_name: str, start: datetime, end: datetime) -> str | None:
        access_token = await self._auth.get_valid_access_token()
        if access_token is None:
            return None
        try:
            return await self._calendar.create_event(access_token, task_name, start, end)
        except Exception:
            return None

    async def update_interval(
        self, google_event_id: str, task_name: str, start: datetime, end: datetime
    ) -> None:
        access_token = await self._auth.get_valid_access_token()
        if access_token is None:
            return
        try:
            await self._calendar.update_event(access_token, google_event_id, task_name, start, end)
        except Exception:
            pass

    async def delete_interval(self, google_event_id: str) -> None:
        access_token = await self._auth.get_valid_access_token()
        if access_token is None:
            return
        try:
            await self._calendar.delete_event(access_token, google_event_id)
        except Exception:
            pass

    async def list_events(self, time_min: datetime, time_max: datetime) -> list[GoogleEventOut]:
        access_token = await self._auth.get_valid_access_token()
        if access_token is None:
            return []
        try:
            return await self._calendar.list_events(access_token, time_min, time_max)
        except Exception:
            return []

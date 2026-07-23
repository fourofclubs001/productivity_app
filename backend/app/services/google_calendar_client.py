from datetime import UTC, datetime
from typing import Protocol
from uuid import uuid4

import httpx

from app.models.google import GoogleEventOut

CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"


def _rfc3339(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.isoformat()


class GoogleCalendarClient(Protocol):
    async def create_event(
        self, access_token: str, summary: str, start: datetime, end: datetime
    ) -> str: ...

    async def update_event(
        self, access_token: str, event_id: str, summary: str, start: datetime, end: datetime
    ) -> None: ...

    async def delete_event(self, access_token: str, event_id: str) -> None: ...

    async def list_events(
        self, access_token: str, time_min: datetime, time_max: datetime
    ) -> list[GoogleEventOut]: ...


class HttpxGoogleCalendarClient:
    async def create_event(
        self, access_token: str, summary: str, start: datetime, end: datetime
    ) -> str:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                CALENDAR_EVENTS_URL,
                headers={"Authorization": f"Bearer {access_token}"},
                json={
                    "summary": summary,
                    "start": {"dateTime": _rfc3339(start)},
                    "end": {"dateTime": _rfc3339(end)},
                },
            )
            response.raise_for_status()
            return response.json()["id"]

    async def update_event(
        self, access_token: str, event_id: str, summary: str, start: datetime, end: datetime
    ) -> None:
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{CALENDAR_EVENTS_URL}/{event_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                json={
                    "summary": summary,
                    "start": {"dateTime": _rfc3339(start)},
                    "end": {"dateTime": _rfc3339(end)},
                },
            )
            response.raise_for_status()

    async def delete_event(self, access_token: str, event_id: str) -> None:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{CALENDAR_EVENTS_URL}/{event_id}",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            # 404 means it's already gone from Google's side -- not our problem
            # to surface as a failure, the local delete should still proceed.
            if response.status_code not in (204, 404):
                response.raise_for_status()

    async def list_events(
        self, access_token: str, time_min: datetime, time_max: datetime
    ) -> list[GoogleEventOut]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                CALENDAR_EVENTS_URL,
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "timeMin": _rfc3339(time_min),
                    "timeMax": _rfc3339(time_max),
                    "singleEvents": "true",
                    "orderBy": "startTime",
                },
            )
            response.raise_for_status()
            events = []
            for item in response.json().get("items", []):
                # All-day events carry a date-only "date" field instead of
                # "dateTime" -- skip them, this app's intervals are always
                # timed, so there's nothing to render them against.
                start = item.get("start", {}).get("dateTime")
                end = item.get("end", {}).get("dateTime")
                if not start or not end:
                    continue
                events.append(
                    GoogleEventOut(
                        id=item["id"],
                        title=item.get("summary") or "(no title)",
                        start=datetime.fromisoformat(start),
                        end=datetime.fromisoformat(end),
                    )
                )
            return events


class FakeGoogleCalendarClient:
    """No-network stand-in used whenever Google credentials aren't configured
    -- see app/dependencies.py.
    """

    def __init__(self, events: list[GoogleEventOut] | None = None) -> None:
        self._events = events or []

    async def create_event(
        self, access_token: str, summary: str, start: datetime, end: datetime
    ) -> str:
        return f"fake-event-{uuid4()}"

    async def update_event(
        self, access_token: str, event_id: str, summary: str, start: datetime, end: datetime
    ) -> None:
        return None

    async def delete_event(self, access_token: str, event_id: str) -> None:
        return None

    async def list_events(
        self, access_token: str, time_min: datetime, time_max: datetime
    ) -> list[GoogleEventOut]:
        return list(self._events)

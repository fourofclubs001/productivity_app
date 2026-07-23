from datetime import UTC, date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies import get_google_sync_service, get_interval_service
from app.models.google import GoogleEventOut
from app.services.google_sync_service import GoogleSyncService
from app.services.interval_service import IntervalService

router = APIRouter(prefix="/google", tags=["google"])

GoogleDep = Annotated[GoogleSyncService, Depends(get_google_sync_service)]
IntervalDep = Annotated[IntervalService, Depends(get_interval_service)]


@router.get("/events", response_model=list[GoogleEventOut])
async def list_google_events(
    week_start: str, google: GoogleDep, intervals: IntervalDep
) -> list[GoogleEventOut]:
    time_min = datetime.combine(date.fromisoformat(week_start), datetime.min.time(), tzinfo=UTC)
    time_max = time_min + timedelta(days=7)

    events = await google.list_events(time_min, time_max)

    # Exclude events this app already pushed to Google (M37) -- those are
    # already visible as the interval's own chip, so pulling them back in
    # here too would render every self-synced event twice.
    linked_ids = {
        interval.google_event_id
        for interval in await intervals.list_for_week(week_start)
        if interval.google_event_id
    }
    return [event for event in events if event.id not in linked_ids]

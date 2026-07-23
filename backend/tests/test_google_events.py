from datetime import UTC, datetime, timedelta

from app.dependencies import get_google_calendar_client
from app.main import app
from app.models.google import GoogleEventOut
from app.services.google_calendar_client import FakeGoogleCalendarClient
from tests.test_google_sync import connect_google, create_interval, create_leaf


def week_start_for(dt: datetime) -> str:
    return (dt - timedelta(days=dt.weekday())).date().isoformat()


def seed_events(events: list[GoogleEventOut]) -> None:
    app.dependency_overrides[get_google_calendar_client] = lambda: FakeGoogleCalendarClient(
        events=events
    )


def test_list_events_requires_connection(client):
    week_start = week_start_for(datetime.now(UTC) + timedelta(days=1))
    response = client.get(f"/google/events?week_start={week_start}")
    assert response.status_code == 200
    assert response.json() == []


def test_list_events_returns_pulled_events(client):
    connect_google(client)
    day = datetime.now(UTC) + timedelta(days=1)
    week_start = week_start_for(day)
    event = GoogleEventOut(
        id="ext-1", title="Dentist", start=day, end=day + timedelta(hours=1)
    )
    seed_events([event])
    try:
        response = client.get(f"/google/events?week_start={week_start}")
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["id"] == "ext-1"
        assert body[0]["title"] == "Dentist"
    finally:
        del app.dependency_overrides[get_google_calendar_client]


def test_list_events_excludes_self_synced_events(client):
    connect_google(client)
    task = create_leaf(client)
    # Connection is already established, so M37's auto-sync-on-creation
    # pushes this interval to Google immediately -- no manual push needed.
    interval = create_interval(client, task["id"])
    week_start = week_start_for(datetime.fromisoformat(interval["start"]))
    linked_event_id = interval["google_event_id"]
    assert linked_event_id

    day = datetime.fromisoformat(interval["start"])
    seed_events(
        [
            GoogleEventOut(
                id=linked_event_id, title="Self-synced", start=day, end=day + timedelta(hours=1)
            ),
            GoogleEventOut(
                id="ext-2", title="Real external", start=day, end=day + timedelta(hours=1)
            ),
        ]
    )
    try:
        response = client.get(f"/google/events?week_start={week_start}")
        assert response.status_code == 200
        body = response.json()
        assert [event["id"] for event in body] == ["ext-2"]
    finally:
        del app.dependency_overrides[get_google_calendar_client]

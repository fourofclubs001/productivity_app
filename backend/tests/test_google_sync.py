from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse


def connect_google(client) -> None:
    login = client.get("/auth/google/login", follow_redirects=False)
    parsed_query = parse_qs(urlparse(login.headers["location"]).query)
    query = {key: values[0] for key, values in parsed_query.items()}
    callback = client.get(
        "/auth/google/callback",
        params={"code": query["code"], "state": query["state"]},
        follow_redirects=False,
    )
    assert callback.status_code in (302, 307)


def create_leaf(client, name="Leaf"):
    response = client.post("/tasks", json={"name": name, "definition_of_done": "d"})
    assert response.status_code == 201
    return response.json()


def create_interval(client, task_id: str) -> dict:
    start = datetime.now(UTC) + timedelta(days=1)
    end = start + timedelta(hours=1)
    response = client.post(
        "/intervals",
        json={"task_id": task_id, "start": start.isoformat(), "end": end.isoformat()},
    )
    assert response.status_code == 201
    return response.json()


def test_push_to_google_requires_a_connection(client):
    task = create_leaf(client)
    interval = create_interval(client, task["id"])

    response = client.post(f"/intervals/{interval['id']}/push-to-google")
    assert response.status_code == 409


def test_push_to_google_happy_path(client):
    connect_google(client)
    task = create_leaf(client)
    interval = create_interval(client, task["id"])
    assert interval["google_event_id"] is None

    response = client.post(f"/intervals/{interval['id']}/push-to-google")
    assert response.status_code == 200
    body = response.json()
    assert body["google_event_id"]
    assert body["google_event_id"].startswith("fake-event-")

    # The list endpoints should reflect the same synced id.
    by_task = client.get(f"/intervals/by-task/{task['id']}").json()
    assert by_task[0]["google_event_id"] == body["google_event_id"]


def test_push_to_google_already_synced_is_rejected(client):
    connect_google(client)
    task = create_leaf(client)
    interval = create_interval(client, task["id"])

    first = client.post(f"/intervals/{interval['id']}/push-to-google")
    assert first.status_code == 200

    second = client.post(f"/intervals/{interval['id']}/push-to-google")
    assert second.status_code == 409


def test_push_to_google_missing_interval_is_404(client):
    connect_google(client)
    response = client.post("/intervals/does-not-exist/push-to-google")
    assert response.status_code == 404

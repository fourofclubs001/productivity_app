from urllib.parse import parse_qs, urlparse

import httpx
import respx

from app.services.errors import GoogleAuthError
from app.services.google_oauth_client import (
    GOOGLE_TOKEN_URL,
    HttpxGoogleOAuthClient,
)


def _extract_query(url: str) -> dict[str, str]:
    parsed = urlparse(url)
    return {key: values[0] for key, values in parse_qs(parsed.query).items()}


def test_status_reports_disconnected_by_default(client):
    response = client.get("/auth/google/status")
    assert response.status_code == 200
    assert response.json() == {"connected": False}


def test_connect_flow_via_fake_login_and_callback(client):
    login = client.get("/auth/google/login", follow_redirects=False)
    assert login.status_code in (302, 307)
    query = _extract_query(login.headers["location"])
    assert query["code"] == "fake-google-code"
    state = query["state"]

    callback = client.get(
        "/auth/google/callback",
        params={"code": query["code"], "state": state},
        follow_redirects=False,
    )
    assert callback.status_code in (302, 307)

    status = client.get("/auth/google/status")
    assert status.json() == {"connected": True}


def test_callback_rejects_invalid_state(client):
    response = client.get(
        "/auth/google/callback",
        params={"code": "fake-google-code", "state": "not-a-real-state"},
    )
    assert response.status_code == 400


def test_callback_state_is_single_use(client):
    login = client.get("/auth/google/login", follow_redirects=False)
    query = _extract_query(login.headers["location"])

    first = client.get(
        "/auth/google/callback",
        params={"code": query["code"], "state": query["state"]},
        follow_redirects=False,
    )
    assert first.status_code in (302, 307)

    replay = client.get(
        "/auth/google/callback",
        params={"code": query["code"], "state": query["state"]},
    )
    assert replay.status_code == 400


def test_disconnect_clears_connection(client):
    login = client.get("/auth/google/login", follow_redirects=False)
    query = _extract_query(login.headers["location"])
    client.get(
        "/auth/google/callback",
        params={"code": query["code"], "state": query["state"]},
        follow_redirects=False,
    )
    assert client.get("/auth/google/status").json() == {"connected": True}

    disconnect = client.post("/auth/google/disconnect")
    assert disconnect.status_code == 204
    assert client.get("/auth/google/status").json() == {"connected": False}


async def test_httpx_client_exchange_code_hits_expected_endpoint():
    oauth = HttpxGoogleOAuthClient("client-id", "client-secret")
    with respx.mock:
        route = respx.post(GOOGLE_TOKEN_URL).mock(
            return_value=httpx.Response(
                200,
                json={
                    "access_token": "real-access",
                    "refresh_token": "real-refresh",
                    "expires_in": 3600,
                },
            )
        )
        token = await oauth.exchange_code("auth-code", "http://localhost:8000/auth/google/callback")

    assert route.called
    sent = route.calls.last.request
    body = dict(pair.split("=") for pair in sent.content.decode().split("&"))
    assert body["grant_type"] == "authorization_code"
    assert body["code"] == "auth-code"
    assert token.access_token == "real-access"
    assert token.refresh_token == "real-refresh"
    assert token.expires_in == 3600


async def test_httpx_client_refresh_hits_expected_endpoint():
    oauth = HttpxGoogleOAuthClient("client-id", "client-secret")
    with respx.mock:
        route = respx.post(GOOGLE_TOKEN_URL).mock(
            return_value=httpx.Response(
                200, json={"access_token": "refreshed-access", "expires_in": 1800}
            )
        )
        token = await oauth.refresh("stored-refresh-token")

    assert route.called
    sent_body = route.calls.last.request.content.decode()
    assert "grant_type=refresh_token" in sent_body
    assert "refresh_token=stored-refresh-token" in sent_body
    assert token.access_token == "refreshed-access"
    assert token.refresh_token is None


def test_google_auth_error_message():
    assert "expired" in str(GoogleAuthError())

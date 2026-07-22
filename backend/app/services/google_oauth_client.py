from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlencode
from uuid import uuid4

import httpx

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"


@dataclass
class GoogleTokenResponse:
    access_token: str
    refresh_token: str | None
    expires_in: int


class GoogleOAuthClient(Protocol):
    def build_auth_url(self, state: str, redirect_uri: str) -> str: ...

    async def exchange_code(self, code: str, redirect_uri: str) -> GoogleTokenResponse: ...

    async def refresh(self, refresh_token: str) -> GoogleTokenResponse: ...


class HttpxGoogleOAuthClient:
    def __init__(self, client_id: str, client_secret: str) -> None:
        self._client_id = client_id
        self._client_secret = client_secret

    def build_auth_url(self, state: str, redirect_uri: str) -> str:
        params = {
            "client_id": self._client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": CALENDAR_SCOPE,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> GoogleTokenResponse:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                    "redirect_uri": redirect_uri,
                },
            )
            response.raise_for_status()
            body = response.json()
        return GoogleTokenResponse(
            access_token=body["access_token"],
            refresh_token=body.get("refresh_token"),
            expires_in=body["expires_in"],
        )

    async def refresh(self, refresh_token: str) -> GoogleTokenResponse:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                },
            )
            response.raise_for_status()
            body = response.json()
        return GoogleTokenResponse(
            access_token=body["access_token"],
            refresh_token=body.get("refresh_token"),
            expires_in=body["expires_in"],
        )


class FakeGoogleOAuthClient:
    """No-network stand-in used whenever Google credentials aren't configured
    (see app/dependencies.py) -- build_auth_url points straight back at our
    own callback with a canned code, so the whole connect flow is exercisable
    in dev/tests without ever reaching Google.
    """

    def build_auth_url(self, state: str, redirect_uri: str) -> str:
        return f"{redirect_uri}?code=fake-google-code&state={state}"

    async def exchange_code(self, code: str, redirect_uri: str) -> GoogleTokenResponse:
        return GoogleTokenResponse(
            access_token=f"fake-access-{uuid4()}",
            refresh_token=f"fake-refresh-{uuid4()}",
            expires_in=3600,
        )

    async def refresh(self, refresh_token: str) -> GoogleTokenResponse:
        return GoogleTokenResponse(
            access_token=f"fake-access-{uuid4()}", refresh_token=None, expires_in=3600
        )

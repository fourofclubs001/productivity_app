from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.models.google import GoogleConnectionStatusOut
from app.repositories.google_repository import GoogleRepository
from app.services.errors import GoogleAuthError
from app.services.google_oauth_client import GoogleOAuthClient

ACCESS_TOKEN_REFRESH_MARGIN = timedelta(seconds=60)


class GoogleAuthService:
    def __init__(
        self, repo: GoogleRepository, oauth_client: GoogleOAuthClient, redirect_uri: str
    ) -> None:
        self._repo = repo
        self._oauth = oauth_client
        self._redirect_uri = redirect_uri

    async def get_status(self) -> GoogleConnectionStatusOut:
        tokens = await self._repo.get_tokens()
        return GoogleConnectionStatusOut(connected=bool(tokens and tokens.get("access_token")))

    async def build_authorize_url(self) -> str:
        state = uuid4().hex
        await self._repo.save_state(state)
        return self._oauth.build_auth_url(state, self._redirect_uri)

    async def handle_callback(self, code: str, state: str) -> None:
        if not await self._repo.consume_state(state):
            raise GoogleAuthError()
        token = await self._oauth.exchange_code(code, self._redirect_uri)
        expires_at = (datetime.now(UTC) + timedelta(seconds=token.expires_in)).isoformat()
        await self._repo.save_tokens(token.access_token, token.refresh_token or "", expires_at)

    async def disconnect(self) -> None:
        await self._repo.clear_tokens()

    async def get_valid_access_token(self) -> str | None:
        """The access token to use for a Calendar API call right now,
        transparently refreshing (and persisting the refresh) if the stored
        one is at or near expiry. Returns None if not connected at all, or
        if refreshing turns out to be impossible (no refresh token stored).
        """
        tokens = await self._repo.get_tokens()
        if not tokens or not tokens.get("access_token"):
            return None

        expires_at = datetime.fromisoformat(tokens["expires_at"])
        if expires_at > datetime.now(UTC) + ACCESS_TOKEN_REFRESH_MARGIN:
            return tokens["access_token"]

        refresh_token = tokens.get("refresh_token")
        if not refresh_token:
            return None
        refreshed = await self._oauth.refresh(refresh_token)
        new_expires_at = (datetime.now(UTC) + timedelta(seconds=refreshed.expires_in)).isoformat()
        await self._repo.update_access_token(refreshed.access_token, new_expires_at)
        return refreshed.access_token

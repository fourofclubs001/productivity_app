from typing import Any

from redis.asyncio import Redis

GOOGLE_TOKENS_KEY = "google:tokens"
OAUTH_STATE_TTL_SECONDS = 600


def oauth_state_key(state: str) -> str:
    return f"google:oauth_state:{state}"


class GoogleRepository:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def save_state(self, state: str) -> None:
        await self._redis.set(oauth_state_key(state), "1", ex=OAUTH_STATE_TTL_SECONDS)

    async def consume_state(self, state: str) -> bool:
        key = oauth_state_key(state)
        existed = await self._redis.exists(key)
        if existed:
            await self._redis.delete(key)
        return bool(existed)

    async def save_tokens(self, access_token: str, refresh_token: str, expires_at: str) -> None:
        await self._redis.hset(
            GOOGLE_TOKENS_KEY,
            mapping={
                "access_token": access_token,
                "refresh_token": refresh_token,
                "expires_at": expires_at,
            },
        )

    async def get_tokens(self) -> dict[str, Any] | None:
        data = await self._redis.hgetall(GOOGLE_TOKENS_KEY)
        return data or None

    async def update_access_token(self, access_token: str, expires_at: str) -> None:
        await self._redis.hset(
            GOOGLE_TOKENS_KEY, mapping={"access_token": access_token, "expires_at": expires_at}
        )

    async def clear_tokens(self) -> None:
        await self._redis.delete(GOOGLE_TOKENS_KEY)

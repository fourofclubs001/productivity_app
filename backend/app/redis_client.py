from collections.abc import AsyncIterator

from redis.asyncio import Redis

from app.config import settings

_redis: Redis | None = None


def get_redis_client() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def get_redis() -> AsyncIterator[Redis]:
    yield get_redis_client()

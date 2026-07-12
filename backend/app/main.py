from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from redis.exceptions import RedisError

from app.config import settings
from app.redis_client import get_redis_client

app = FastAPI(title="Productivity App API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    redis_ok = True
    try:
        await get_redis_client().ping()
    except RedisError:
        redis_ok = False
    return {"status": "ok" if redis_ok else "degraded", "redis": redis_ok}

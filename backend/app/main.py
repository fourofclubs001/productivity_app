from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from redis.exceptions import RedisError

from app.config import settings
from app.redis_client import get_redis_client
from app.routers import evaluate, excuses, google, intervals, tasks, timer

app = FastAPI(title="Productivity App API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router)
app.include_router(intervals.router)
app.include_router(timer.router)
app.include_router(evaluate.router)
app.include_router(excuses.router)
app.include_router(google.router)


@app.get("/health")
async def health() -> dict:
    redis_ok = True
    try:
        await get_redis_client().ping()
    except RedisError:
        redis_ok = False
    return {"status": "ok" if redis_ok else "degraded", "redis": redis_ok}

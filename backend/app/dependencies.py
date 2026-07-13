from typing import Annotated

from fastapi import Depends
from redis.asyncio import Redis

from app.redis_client import get_redis
from app.repositories.entry_repository import EntryRepository
from app.repositories.interval_repository import IntervalRepository
from app.repositories.task_repository import TaskRepository
from app.services.evaluate_service import EvaluateService
from app.services.interval_service import IntervalService
from app.services.rollover_service import RolloverService
from app.services.task_service import TaskService
from app.services.timer_service import TimerService


def get_task_service(redis: Annotated[Redis, Depends(get_redis)]) -> TaskService:
    return TaskService(TaskRepository(redis))


def get_interval_service(redis: Annotated[Redis, Depends(get_redis)]) -> IntervalService:
    task_repo = TaskRepository(redis)
    return IntervalService(IntervalRepository(redis), task_repo, TaskService(task_repo))


def get_timer_service(redis: Annotated[Redis, Depends(get_redis)]) -> TimerService:
    return TimerService(EntryRepository(redis), TaskRepository(redis))


def get_evaluate_service(redis: Annotated[Redis, Depends(get_redis)]) -> EvaluateService:
    return EvaluateService(TaskRepository(redis), IntervalRepository(redis), EntryRepository(redis))


def get_rollover_service(redis: Annotated[Redis, Depends(get_redis)]) -> RolloverService:
    return RolloverService(redis, IntervalRepository(redis))


async def apply_rollover(
    rollover: Annotated[RolloverService, Depends(get_rollover_service)],
) -> None:
    await rollover.ensure_applied()

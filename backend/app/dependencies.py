from typing import Annotated

from fastapi import Depends
from redis.asyncio import Redis

from app.redis_client import get_redis
from app.repositories.task_repository import TaskRepository
from app.services.task_service import TaskService


def get_task_service(redis: Annotated[Redis, Depends(get_redis)]) -> TaskService:
    return TaskService(TaskRepository(redis))

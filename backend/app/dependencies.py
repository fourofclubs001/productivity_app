from typing import Annotated

from fastapi import Depends
from redis.asyncio import Redis

from app.config import settings
from app.redis_client import get_redis
from app.repositories.entry_repository import EntryRepository
from app.repositories.excuse_repository import ExcuseRepository
from app.repositories.google_repository import GoogleRepository
from app.repositories.interval_repository import IntervalRepository
from app.repositories.task_repository import TaskRepository
from app.services.evaluate_service import EvaluateService
from app.services.excuse_service import ExcuseService
from app.services.google_auth_service import GoogleAuthService
from app.services.google_calendar_client import (
    FakeGoogleCalendarClient,
    GoogleCalendarClient,
    HttpxGoogleCalendarClient,
)
from app.services.google_oauth_client import (
    FakeGoogleOAuthClient,
    GoogleOAuthClient,
    HttpxGoogleOAuthClient,
)
from app.services.google_sync_service import GoogleSyncService
from app.services.interval_service import IntervalService
from app.services.recurrent_task_service import RecurrentTaskService
from app.services.rollover_service import RolloverService
from app.services.task_service import TaskService
from app.services.timer_service import TimerService


def get_task_service(redis: Annotated[Redis, Depends(get_redis)]) -> TaskService:
    return TaskService(TaskRepository(redis))


def get_google_oauth_client() -> GoogleOAuthClient:
    # Falls back to the no-network fake whenever real credentials aren't
    # configured (the default in dev/CI), so the whole connect flow stays
    # fully testable without ever reaching Google -- see FakeGoogleOAuthClient.
    if settings.google_client_id and settings.google_client_secret:
        return HttpxGoogleOAuthClient(settings.google_client_id, settings.google_client_secret)
    return FakeGoogleOAuthClient()


def get_google_auth_service(
    redis: Annotated[Redis, Depends(get_redis)],
    oauth_client: Annotated[GoogleOAuthClient, Depends(get_google_oauth_client)],
) -> GoogleAuthService:
    return GoogleAuthService(GoogleRepository(redis), oauth_client, settings.google_redirect_uri)


def get_google_calendar_client() -> GoogleCalendarClient:
    if settings.google_client_id and settings.google_client_secret:
        return HttpxGoogleCalendarClient()
    return FakeGoogleCalendarClient()


def get_google_sync_service(
    auth_service: Annotated[GoogleAuthService, Depends(get_google_auth_service)],
    calendar_client: Annotated[GoogleCalendarClient, Depends(get_google_calendar_client)],
) -> GoogleSyncService:
    return GoogleSyncService(auth_service, calendar_client)


def get_interval_service(
    redis: Annotated[Redis, Depends(get_redis)],
    google: Annotated[GoogleSyncService, Depends(get_google_sync_service)],
) -> IntervalService:
    task_repo = TaskRepository(redis)
    return IntervalService(IntervalRepository(redis), task_repo, TaskService(task_repo), google)


def get_timer_service(redis: Annotated[Redis, Depends(get_redis)]) -> TimerService:
    task_repo = TaskRepository(redis)
    return TimerService(EntryRepository(redis), task_repo, TaskService(task_repo))


def get_evaluate_service(redis: Annotated[Redis, Depends(get_redis)]) -> EvaluateService:
    return EvaluateService(TaskRepository(redis), IntervalRepository(redis), EntryRepository(redis))


def get_excuse_service(redis: Annotated[Redis, Depends(get_redis)]) -> ExcuseService:
    return ExcuseService(ExcuseRepository(redis), TaskRepository(redis))


def get_rollover_service(redis: Annotated[Redis, Depends(get_redis)]) -> RolloverService:
    return RolloverService(redis, IntervalRepository(redis))


async def apply_rollover(
    rollover: Annotated[RolloverService, Depends(get_rollover_service)],
) -> None:
    await rollover.ensure_applied()


def get_recurrent_task_service(
    redis: Annotated[Redis, Depends(get_redis)],
    google: Annotated[GoogleSyncService, Depends(get_google_sync_service)],
) -> RecurrentTaskService:
    task_repo = TaskRepository(redis)
    task_service = TaskService(task_repo)
    interval_service = IntervalService(
        IntervalRepository(redis), task_repo, task_service, google
    )
    return RecurrentTaskService(redis, task_repo, task_service, interval_service)


async def apply_recurrent_task_catchup(
    recurrent_tasks: Annotated[RecurrentTaskService, Depends(get_recurrent_task_service)],
) -> None:
    await recurrent_tasks.ensure_applied()

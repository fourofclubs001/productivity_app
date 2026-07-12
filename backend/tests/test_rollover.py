from datetime import date, datetime, timedelta

import pytest

from app.models.interval import IntervalCreate
from app.models.task import TaskCreate, TaskState
from app.repositories.interval_repository import IntervalRepository
from app.repositories.task_repository import TaskRepository
from app.services.interval_service import IntervalService
from app.services.rollover_service import RolloverService
from app.services.task_service import TaskService


@pytest.fixture
def services(redis_client):
    task_repo = TaskRepository(redis_client)
    interval_repo = IntervalRepository(redis_client)
    return {
        "task_repo": task_repo,
        "tasks": TaskService(task_repo),
        "intervals": IntervalService(interval_repo, task_repo),
        "rollover": RolloverService(redis_client, interval_repo),
    }


async def schedule(services, task_id: str, day: date) -> None:
    start = datetime(day.year, day.month, day.day, 9)
    await services["intervals"].create_interval(
        IntervalCreate(task_id=task_id, start=start, end=start + timedelta(hours=1))
    )


async def test_rollover_transitions_only_tasks_from_the_week_that_ended(services):
    this_monday = date(2026, 7, 13)
    last_monday = this_monday - timedelta(days=7)

    sprint_backlog_task = await services["tasks"].create_task(
        TaskCreate(name="Backlog", definition_of_done="d")
    )
    in_progress_task = await services["tasks"].create_task(
        TaskCreate(name="In progress", definition_of_done="d")
    )
    sprint_done_task = await services["tasks"].create_task(
        TaskCreate(name="Sprint done", definition_of_done="d")
    )
    future_task = await services["tasks"].create_task(
        TaskCreate(name="Future", definition_of_done="d")
    )

    await schedule(services, sprint_backlog_task.id, last_monday)
    await schedule(services, in_progress_task.id, last_monday)
    await schedule(services, sprint_done_task.id, last_monday)
    await schedule(services, future_task.id, this_monday + timedelta(days=7))

    await services["task_repo"].update_fields(
        in_progress_task.id, {"state": TaskState.in_progress.value}
    )
    await services["task_repo"].update_fields(
        sprint_done_task.id, {"state": TaskState.sprint_done.value}
    )

    # Establish the baseline (no history to roll over on first ever run)...
    await services["rollover"].ensure_applied(today=last_monday)
    # ...then cross into "this" week, which should roll over last week's tasks.
    await services["rollover"].ensure_applied(today=this_monday)

    assert (await services["tasks"].get_task(sprint_backlog_task.id)).state == TaskState.backlog
    assert (await services["tasks"].get_task(in_progress_task.id)).state == TaskState.backlog
    assert (await services["tasks"].get_task(sprint_done_task.id)).state == TaskState.done
    assert (await services["tasks"].get_task(future_task.id)).state == TaskState.sprint_backlog


async def test_rollover_is_idempotent_within_the_same_week(services):
    this_monday = date(2026, 7, 13)
    last_monday = this_monday - timedelta(days=7)

    task = await services["tasks"].create_task(TaskCreate(name="T", definition_of_done="d"))
    await schedule(services, task.id, last_monday)

    await services["rollover"].ensure_applied(today=last_monday)
    await services["rollover"].ensure_applied(today=this_monday)

    # Flip back to sprint_backlog to prove a second call in the same week is a no-op.
    await services["task_repo"].update_fields(task.id, {"state": TaskState.sprint_backlog.value})
    await services["rollover"].ensure_applied(today=this_monday)

    assert (await services["tasks"].get_task(task.id)).state == TaskState.sprint_backlog


async def test_rollover_processes_multiple_missed_weeks(services):
    week1_monday = date(2026, 7, 13)
    week2_monday = week1_monday + timedelta(days=7)
    week3_monday = week2_monday + timedelta(days=7)

    task = await services["tasks"].create_task(TaskCreate(name="T", definition_of_done="d"))
    await schedule(services, task.id, week2_monday)

    await services["rollover"].ensure_applied(today=week1_monday)
    # Jump straight to week 3 without checking in during week 2.
    await services["rollover"].ensure_applied(today=week3_monday)

    assert (await services["tasks"].get_task(task.id)).state == TaskState.backlog

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from redis.asyncio import Redis

from app.dependencies import apply_rollover, get_task_service
from app.models.task import (
    PALETTE,
    AddParentRequest,
    AddRequirementRequest,
    ReorderRequest,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)
from app.redis_client import get_redis
from app.repositories.entry_repository import EntryRepository
from app.repositories.interval_repository import IntervalRepository
from app.services.errors import (
    CycleError,
    InvalidColorError,
    RequirementAncestorError,
    RequirementCycleError,
    SelfParentError,
    SelfRequirementError,
    TaskNotEligibleForBacklogOverrideError,
    TaskNotFoundError,
    TaskNotLeafError,
)
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"], dependencies=[Depends(apply_rollover)])

ServiceDep = Annotated[TaskService, Depends(get_task_service)]


@router.get("/palette")
async def get_palette() -> list[str]:
    return PALETTE


@router.post("", response_model=TaskOut, status_code=201)
async def create_task(payload: TaskCreate, service: ServiceDep) -> TaskOut:
    try:
        return await service.create_task(payload)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidColorError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("", response_model=list[TaskOut])
async def list_tasks(service: ServiceDep) -> list[TaskOut]:
    return await service.list_tasks()


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(task_id: str, service: ServiceDep) -> TaskOut:
    try:
        return await service.get_task(task_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(task_id: str, payload: TaskUpdate, service: ServiceDep) -> TaskOut:
    try:
        return await service.update_task(task_id, payload)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (InvalidColorError, TaskNotLeafError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: str, service: ServiceDep, redis: Annotated[Redis, Depends(get_redis)]
) -> None:
    entry_repo = EntryRepository(redis)
    active_id = await entry_repo.get_active_id()
    if active_id is not None:
        active_entry = await entry_repo.get(active_id)
        if active_entry is not None and active_entry["task_id"] == task_id:
            raise HTTPException(
                status_code=409,
                detail="This task's timer is currently running — stop it before deleting the task.",
            )

    try:
        await service.delete_task(task_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    # A deleted task's future plan no longer makes sense; drop its
    # not-yet-started reserved intervals. Past (and in-progress) intervals
    # are left alone as historical record.
    interval_repo = IntervalRepository(redis)
    now = datetime.now(UTC)
    for interval in await interval_repo.list_for_task(task_id):
        start = datetime.fromisoformat(interval["start"])
        if start.tzinfo is None:
            start = start.replace(tzinfo=UTC)
        if start > now:
            await interval_repo.delete(interval["id"])


@router.post("/{task_id}/parents", response_model=TaskOut)
async def add_parent(task_id: str, payload: AddParentRequest, service: ServiceDep) -> TaskOut:
    try:
        return await service.add_parent(task_id, payload.parent_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SelfParentError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except CycleError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{task_id}/parents/{parent_id}", response_model=TaskOut)
async def remove_parent(task_id: str, parent_id: str, service: ServiceDep) -> TaskOut:
    try:
        return await service.remove_parent(task_id, parent_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{task_id}/order", response_model=TaskOut)
async def reorder_task(task_id: str, payload: ReorderRequest, service: ServiceDep) -> TaskOut:
    try:
        return await service.reorder_task(
            task_id, payload.after_id, payload.before_id, payload.order
        )
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{task_id}/requires", response_model=TaskOut)
async def add_requirement(
    task_id: str, payload: AddRequirementRequest, service: ServiceDep
) -> TaskOut:
    try:
        return await service.add_requirement(task_id, payload.required_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SelfRequirementError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RequirementCycleError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RequirementAncestorError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{task_id}/requires/{required_id}", response_model=TaskOut)
async def remove_requirement(task_id: str, required_id: str, service: ServiceDep) -> TaskOut:
    try:
        return await service.remove_requirement(task_id, required_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{task_id}/keep-as-backlog", response_model=TaskOut)
async def keep_as_backlog(task_id: str, service: ServiceDep) -> TaskOut:
    try:
        return await service.keep_as_backlog(task_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TaskNotEligibleForBacklogOverrideError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

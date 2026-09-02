from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.dependencies import apply_rollover, get_task_service, get_timer_service
from app.models.entry import EntryCreate, EntryOut, EntryUpdate, MarkDoneRequest, StartTimerRequest
from app.models.task import TaskOut
from app.services.errors import (
    ActiveEntryEndLockedError,
    EntryEndBeforeStartError,
    EntryNotFoundError,
    NoActiveTimerError,
    PrerequisiteNotSprintDoneError,
    TaskNotFoundError,
    TaskNotInProgressError,
    TaskNotLeafError,
    TaskNotSprintDoneError,
)
from app.services.task_service import TaskService
from app.services.timer_service import TimerService

router = APIRouter(tags=["timer"], dependencies=[Depends(apply_rollover)])

ServiceDep = Annotated[TimerService, Depends(get_timer_service)]


@router.post("/timer/start", response_model=EntryOut)
async def start_timer(payload: StartTimerRequest, service: ServiceDep) -> EntryOut:
    try:
        return await service.start(payload.task_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TaskNotLeafError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PrerequisiteNotSprintDoneError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/timer/stop", response_model=EntryOut)
async def stop_timer(service: ServiceDep) -> EntryOut:
    try:
        return await service.stop()
    except NoActiveTimerError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/timer/mark-done", response_model=TaskOut)
async def mark_timer_task_done(
    payload: MarkDoneRequest,
    timer_service: ServiceDep,
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskOut:
    try:
        await timer_service.mark_done(payload.task_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TaskNotInProgressError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await task_service.get_task(payload.task_id)


@router.post("/timer/revert-done", response_model=TaskOut)
async def revert_done(
    payload: MarkDoneRequest,
    timer_service: ServiceDep,
    task_service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskOut:
    try:
        await timer_service.revert_done(payload.task_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TaskNotSprintDoneError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return await task_service.get_task(payload.task_id)


@router.post("/timer/mark-subtree-done")
async def mark_subtree_done(payload: MarkDoneRequest, service: ServiceDep) -> list[str]:
    try:
        return await service.mark_subtree_done(payload.task_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/timer/active")
async def get_active_timer(service: ServiceDep) -> EntryOut | None:
    return await service.get_active()


@router.get("/entries", response_model=list[EntryOut])
async def list_entries(
    service: ServiceDep, week_start: Annotated[str, Query(alias="week_start")]
) -> list[EntryOut]:
    return await service.list_for_week(week_start)


@router.get("/entries/by-task/{task_id}", response_model=list[EntryOut])
async def list_entries_for_task(task_id: str, service: ServiceDep) -> list[EntryOut]:
    return await service.list_for_task(task_id)


@router.post("/entries", response_model=EntryOut)
async def create_entry(payload: EntryCreate, service: ServiceDep) -> EntryOut:
    try:
        return await service.create_entry(payload.task_id, payload.start, payload.end)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except EntryEndBeforeStartError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/entries/{entry_id}", response_model=EntryOut)
async def update_entry(entry_id: str, payload: EntryUpdate, service: ServiceDep) -> EntryOut:
    try:
        return await service.update_entry(entry_id, payload.start, payload.end)
    except EntryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (EntryEndBeforeStartError, ActiveEntryEndLockedError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/entries/{entry_id}", status_code=204)
async def delete_entry(entry_id: str, service: ServiceDep) -> Response:
    try:
        await service.delete_entry(entry_id)
    except EntryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=204)

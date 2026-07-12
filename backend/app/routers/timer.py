from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import apply_rollover, get_timer_service
from app.models.entry import EntryOut, StartTimerRequest, StopTimerRequest
from app.services.errors import NoActiveTimerError, TaskNotFoundError, TaskNotLeafError
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


@router.post("/timer/stop", response_model=EntryOut)
async def stop_timer(payload: StopTimerRequest, service: ServiceDep) -> EntryOut:
    try:
        return await service.stop(payload.mark_done)
    except NoActiveTimerError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/timer/active")
async def get_active_timer(service: ServiceDep) -> EntryOut | None:
    return await service.get_active()


@router.get("/entries", response_model=list[EntryOut])
async def list_entries(
    service: ServiceDep, week_start: Annotated[str, Query(alias="week_start")]
) -> list[EntryOut]:
    return await service.list_for_week(week_start)

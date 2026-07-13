from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import apply_rollover, get_interval_service
from app.models.interval import IntervalCreate, IntervalOut
from app.services.errors import (
    IntervalNotFoundError,
    InvalidIntervalError,
    TaskNotFoundError,
    TaskNotLeafError,
    UnmetPrerequisiteError,
)
from app.services.interval_service import IntervalService

router = APIRouter(prefix="/intervals", tags=["intervals"], dependencies=[Depends(apply_rollover)])

ServiceDep = Annotated[IntervalService, Depends(get_interval_service)]


@router.post("", response_model=IntervalOut, status_code=201)
async def create_interval(payload: IntervalCreate, service: ServiceDep) -> IntervalOut:
    try:
        return await service.create_interval(payload)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (InvalidIntervalError, TaskNotLeafError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except UnmetPrerequisiteError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.delete("/{interval_id}", status_code=204)
async def delete_interval(interval_id: str, service: ServiceDep) -> None:
    try:
        await service.delete_interval(interval_id)
    except IntervalNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("", response_model=list[IntervalOut])
async def list_intervals(
    service: ServiceDep, week_start: Annotated[str, Query(alias="week_start")]
) -> list[IntervalOut]:
    return await service.list_for_week(week_start)


@router.get("/by-task/{task_id}", response_model=list[IntervalOut])
async def list_intervals_for_task(task_id: str, service: ServiceDep) -> list[IntervalOut]:
    return await service.list_for_task(task_id)

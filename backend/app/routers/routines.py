from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import apply_rollover, apply_routine_catchup, get_routine_service
from app.models.task import RoutineCreate, TaskOut
from app.services.errors import InvalidColorError
from app.services.routine_service import RoutineService

router = APIRouter(
    prefix="/routines",
    tags=["routines"],
    dependencies=[Depends(apply_rollover), Depends(apply_routine_catchup)],
)

ServiceDep = Annotated[RoutineService, Depends(get_routine_service)]


@router.post("", response_model=TaskOut, status_code=201)
async def create_routine(payload: RoutineCreate, service: ServiceDep) -> TaskOut:
    try:
        return await service.create_routine(payload)
    except InvalidColorError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import (
    apply_recurrent_task_catchup,
    apply_rollover,
    get_recurrent_task_service,
)
from app.models.task import RecurrentTaskCreate, TaskOut
from app.services.errors import InvalidColorError
from app.services.recurrent_task_service import RecurrentTaskService

router = APIRouter(
    prefix="/recurrent-tasks",
    tags=["recurrent-tasks"],
    dependencies=[Depends(apply_rollover), Depends(apply_recurrent_task_catchup)],
)

ServiceDep = Annotated[RecurrentTaskService, Depends(get_recurrent_task_service)]


@router.post("", response_model=TaskOut, status_code=201)
async def create_recurrent_task(payload: RecurrentTaskCreate, service: ServiceDep) -> TaskOut:
    try:
        return await service.create_recurrent_task(payload)
    except InvalidColorError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

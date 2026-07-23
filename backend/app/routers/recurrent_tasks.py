from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import (
    apply_recurrent_task_catchup,
    apply_rollover,
    get_recurrent_task_service,
)
from app.models.task import (
    RecurrentGroupCreate,
    RecurrentReorderRequest,
    RecurrentReparentRequest,
    RecurrentTaskCreate,
    TaskOut,
)
from app.services.errors import (
    InvalidColorError,
    InvalidRecurrentParentError,
    RecurrentGroupNotFoundError,
    TaskNotFoundError,
)
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


@router.post("/groups", response_model=TaskOut, status_code=201)
async def create_recurrent_group(payload: RecurrentGroupCreate, service: ServiceDep) -> TaskOut:
    return await service.create_recurrent_group(payload)


@router.delete("/groups/{group_id}", status_code=204)
async def delete_recurrent_group(
    group_id: str,
    service: ServiceDep,
    delete_children: Annotated[bool, Query()] = False,
) -> None:
    try:
        await service.delete_recurrent_group(group_id, delete_children)
    except RecurrentGroupNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{item_id}/parent", response_model=TaskOut)
async def move_recurrent_item(
    item_id: str, payload: RecurrentReparentRequest, service: ServiceDep
) -> TaskOut:
    try:
        return await service.move_recurrent_item(item_id, payload.parent_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidRecurrentParentError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/{item_id}/order", response_model=TaskOut)
async def reorder_recurrent_item(
    item_id: str, payload: RecurrentReorderRequest, service: ServiceDep
) -> TaskOut:
    try:
        return await service.reorder_recurrent_item(
            item_id, payload.after_id, payload.before_id, payload.order
        )
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

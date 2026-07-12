from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_task_service
from app.models.task import PALETTE, AddParentRequest, TaskCreate, TaskOut, TaskUpdate
from app.services.errors import CycleError, InvalidColorError, SelfParentError, TaskNotFoundError
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])

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
    except InvalidColorError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: str, service: ServiceDep) -> None:
    try:
        await service.delete_task(task_id)
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


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

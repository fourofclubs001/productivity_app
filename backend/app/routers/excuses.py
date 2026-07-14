from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import apply_rollover, get_excuse_service
from app.models.excuse import (
    AttachExcuseRequest,
    ExcuseAttachmentOut,
    ExcuseFrequencyResult,
    ExcuseOut,
)
from app.services.errors import ExcuseNotFoundError, ExcuseSelectionRequiredError, TaskNotFoundError
from app.services.excuse_service import ExcuseService
from app.services.period_utils import Granularity

router = APIRouter(prefix="/excuses", tags=["excuses"], dependencies=[Depends(apply_rollover)])

ServiceDep = Annotated[ExcuseService, Depends(get_excuse_service)]


@router.get("", response_model=list[ExcuseOut])
async def list_excuses(service: ServiceDep) -> list[ExcuseOut]:
    return await service.list_excuses()


@router.post("/attach", response_model=ExcuseAttachmentOut)
async def attach_excuse(payload: AttachExcuseRequest, service: ServiceDep) -> ExcuseAttachmentOut:
    try:
        return await service.attach(
            payload.task_id,
            payload.interval_id,
            payload.start,
            payload.end,
            payload.excuse_id,
            payload.new_excuse_text,
        )
    except TaskNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ExcuseNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ExcuseSelectionRequiredError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/frequency", response_model=ExcuseFrequencyResult)
async def excuse_frequency(
    service: ServiceDep,
    granularity: Granularity,
    date_: Annotated[date, Query(alias="date")],
    task_ids: Annotated[list[str] | None, Query(alias="task_ids")] = None,
) -> ExcuseFrequencyResult:
    return await service.get_frequency(granularity, date_, task_ids)

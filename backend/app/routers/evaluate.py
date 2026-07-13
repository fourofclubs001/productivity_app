from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.dependencies import apply_rollover, get_evaluate_service
from app.services.evaluate_service import EvaluatePeriodResult, EvaluateService, Granularity

router = APIRouter(prefix="/evaluate", tags=["evaluate"], dependencies=[Depends(apply_rollover)])


@router.get("/period", response_model=EvaluatePeriodResult)
async def evaluate_period(
    service: Annotated[EvaluateService, Depends(get_evaluate_service)],
    granularity: Granularity,
    date_: Annotated[date, Query(alias="date")],
    task_ids: Annotated[list[str] | None, Query(alias="task_ids")] = None,
) -> EvaluatePeriodResult:
    return await service.evaluate_period(granularity, date_, task_ids)

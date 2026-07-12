from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.dependencies import apply_rollover, get_evaluate_service
from app.services.evaluate_service import EvaluateService, EvaluateWeekResult

router = APIRouter(prefix="/evaluate", tags=["evaluate"], dependencies=[Depends(apply_rollover)])


@router.get("/week", response_model=EvaluateWeekResult)
async def evaluate_week(
    service: Annotated[EvaluateService, Depends(get_evaluate_service)],
    week_start: Annotated[str, Query(alias="week_start")],
) -> EvaluateWeekResult:
    return await service.evaluate_week(week_start)

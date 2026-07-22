from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse

from app.config import settings
from app.dependencies import get_google_auth_service
from app.models.google import GoogleConnectionStatusOut
from app.services.errors import GoogleAuthError
from app.services.google_auth_service import GoogleAuthService

router = APIRouter(prefix="/auth/google", tags=["google"])

ServiceDep = Annotated[GoogleAuthService, Depends(get_google_auth_service)]


@router.get("/status", response_model=GoogleConnectionStatusOut)
async def google_status(service: ServiceDep) -> GoogleConnectionStatusOut:
    return await service.get_status()


@router.get("/login")
async def google_login(service: ServiceDep) -> RedirectResponse:
    url = await service.build_authorize_url()
    return RedirectResponse(url)


@router.get("/callback")
async def google_callback(service: ServiceDep, code: str, state: str) -> RedirectResponse:
    try:
        await service.handle_callback(code, state)
    except GoogleAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return RedirectResponse(settings.cors_origins[0])


@router.post("/disconnect", status_code=204)
async def google_disconnect(service: ServiceDep) -> None:
    await service.disconnect()

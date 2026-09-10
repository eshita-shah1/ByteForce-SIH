from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.schemas.shortfall import ShortfallRequest, ShortfallResponse
from app.services.shortfall_service import predict_shortfall

router = APIRouter(tags=["shortfall"])


@router.post("/api/shortfall", response_model=ShortfallResponse)
async def shortfall(request: ShortfallRequest, settings: Settings = Depends(get_settings)):
    return await predict_shortfall(request, settings)

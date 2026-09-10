from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.database import get_db
from app.schemas.shortfall import ShortfallRequest, ShortfallResponse
from app.services import log_service
from app.services.shortfall_service import predict_shortfall

router = APIRouter(tags=["shortfall"])


@router.post("/api/shortfall", response_model=ShortfallResponse)
async def shortfall(
    request: ShortfallRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    result = await predict_shortfall(request, settings)
    log_service.record_run(
        db,
        model_type="Shortfall",
        title=f"Shortfall forecast — {result.pit_id} ({result.shift_type} shift)",
        target_site=result.pit_id,
        metric_highlight=f"{result.shortfall_percentage:.1f}% shortfall · {result.risk}",
        status="Flagged" if result.risk in ("Alert", "Critical") else "Completed",
    )
    return result

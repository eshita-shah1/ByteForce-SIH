from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.database import get_db
from app.schemas.prospectivity import ProspectivityRequest, ProspectivityResponse
from app.services import prospectivity_service

router = APIRouter(tags=["prospectivity"])


@router.post("/api/prospectivity", response_model=ProspectivityResponse)
def predict_prospectivity(
    request: ProspectivityRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    return prospectivity_service.predict_from_existing_study_area(
        db, request.latitude, request.longitude, settings
    )

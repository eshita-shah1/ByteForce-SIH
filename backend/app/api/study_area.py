from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.exceptions import NoMatchingRecordError
from app.db.database import get_db
from app.services import gis_service

router = APIRouter(tags=["study-area"])


@router.get("/api/study-area")
def get_study_area(db: Session = Depends(get_db)):
    feature = gis_service.get_study_area_geojson(db)
    if feature is None:
        raise NoMatchingRecordError(
            "Study area has not been initialized.",
            details="Run scripts/import_prospectivity_data.py first.",
        )
    return {"success": True, "type": "FeatureCollection", "features": [feature]}

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.exceptions import NoMatchingRecordError, OutsideStudyAreaError
from app.ml.model1.feature_schema import get_feature_columns
from app.schemas.prospectivity import ProspectivityLocation, ProspectivityResponse
from app.services import gis_service
from app.services.model1_service import model1_service
from app.services.prospectivity_report import build_prospectivity_report

logger = logging.getLogger("app.prospectivity")


def predict_from_existing_study_area(
    db: Session, latitude: float, longitude: float, settings: Settings
) -> ProspectivityResponse:
    boundary = gis_service.get_study_area_geojson(db)
    if boundary is None:
        raise NoMatchingRecordError(
            "Study area has not been initialized.",
            details="Run scripts/import_prospectivity_data.py first.",
        )

    cell = gis_service.find_nearest_cell(db, latitude, longitude, settings)
    if cell is None:
        raise OutsideStudyAreaError(
            "The selected location is outside the existing study area (or too far from any known grid cell).",
            details=(
                f"No prospectivity_features row within {settings.grid_match_tolerance_m}m "
                f"of ({latitude}, {longitude})."
            ),
        )

    feature_columns = get_feature_columns()
    feature_dict = {c: cell[c] for c in feature_columns}

    result = model1_service.predict(feature_dict)
    explanation = model1_service.explain(feature_dict)

    response = ProspectivityResponse(
        location=ProspectivityLocation(latitude=latitude, longitude=longitude),
        prediction=result["prediction"],
        probability=result["probability"],
        decision_threshold=result["decision_threshold"],
        data_source="existing_study_area",
        matched_cell_id=cell["master_cell_id"],
        match_distance_m=round(float(cell["distance_m"]), 2),
        features_used=result["features_used"],
        positive_contributors=explanation["positive_contributors"] if explanation else None,
        negative_contributors=explanation["negative_contributors"] if explanation else None,
    )

    try:
        response.report = build_prospectivity_report(response)
    except Exception:
        logger.exception("Failed to build Model 1 prospectivity report; prediction is unaffected.")

    return response

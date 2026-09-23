from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.exceptions import MissingRequiredFeatureError
from app.db.database import get_db
from app.ml.model1.feature_schema import get_feature_columns
from app.schemas.prospectivity import ProspectivityLocation, ProspectivityRequest, ProspectivityResponse
from app.schemas.upload import DatasetValidationResult, UploadCreateResponse, UploadStatusResponse
from app.services import log_service, upload_service
from app.services.feature_service import SourceIndex
from app.services.model1_service import model1_service

router = APIRouter(tags=["upload"])


@router.post("/api/upload", response_model=UploadCreateResponse)
async def create_upload(
    files: list[UploadFile] = File(...),
    category: str | None = Form(None),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    upload_id = upload_service.create_upload(db, settings)
    await upload_service.save_uploaded_files(db, upload_id, files, settings, category=category)
    result = upload_service.validate_upload(db, upload_id)
    return UploadCreateResponse(upload_id=upload_id, status=result.status)


@router.get("/api/upload/{upload_id}", response_model=UploadStatusResponse)
def get_upload_status(upload_id: str, db: Session = Depends(get_db)):
    upload = upload_service.get_upload(db, upload_id)
    files = upload_service.get_upload_files(db, upload_id)
    validation = (
        DatasetValidationResult.model_validate_json(upload.validation_result_json)
        if upload.validation_result_json
        else None
    )
    return UploadStatusResponse(
        upload_id=upload_id,
        status=upload.status,
        detected_crs=upload.detected_crs,
        bounds=json.loads(upload.bounds_json) if upload.bounds_json else None,
        available_features=json.loads(upload.available_features_json) if upload.available_features_json else [],
        missing_features=json.loads(upload.missing_features_json) if upload.missing_features_json else [],
        files=[f.original_filename for f in files],
        validation=validation,
    )


@router.post("/api/upload/{upload_id}/validate")
def revalidate_upload(upload_id: str, db: Session = Depends(get_db)):
    result = upload_service.validate_upload(db, upload_id)
    return {"success": True, "validation": result}


@router.post("/api/upload/{upload_id}/prospectivity", response_model=ProspectivityResponse)
def predict_from_upload(
    upload_id: str,
    request: ProspectivityRequest,
    db: Session = Depends(get_db),
):
    upload_service.get_upload(db, upload_id)  # 404s if missing
    files = upload_service.get_upload_files(db, upload_id)

    index = SourceIndex(files)
    resolved, checks = index.resolve_features(request.latitude, request.longitude)

    required = set(get_feature_columns())
    missing = sorted(required - set(resolved.keys()))
    if missing:
        raise MissingRequiredFeatureError(
            "Required Model 1 feature(s) could not be extracted from the uploaded dataset at this location.",
            details=f"Missing: {missing}",
        )

    result = model1_service.predict(resolved)
    explanation = model1_service.explain(resolved)

    log_service.record_run(
        db,
        model_type="Prospectivity",
        title=f"Prospectivity scan @ {request.latitude:.4f}, {request.longitude:.4f} (uploaded dataset)",
        target_site=f"{request.latitude:.4f}, {request.longitude:.4f}",
        metric_highlight=f"{result['probability']:.0%} · {result['prediction'].replace('_', ' ')}",
    )

    return ProspectivityResponse(
        location=ProspectivityLocation(latitude=request.latitude, longitude=request.longitude),
        prediction=result["prediction"],
        probability=result["probability"],
        decision_threshold=result["decision_threshold"],
        data_source="uploaded_dataset",
        features_used=result["features_used"],
        positive_contributors=explanation["positive_contributors"] if explanation else None,
        negative_contributors=explanation["negative_contributors"] if explanation else None,
    )

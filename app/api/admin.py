"""Admin-only endpoints. No end-user accounts exist anywhere in this system
(RULE 16) - every route here requires HTTP Basic admin credentials."""
from __future__ import annotations

import shutil

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.exceptions import UploadNotFoundError
from app.core.security import require_admin
from app.db.database import get_db
from app.db.models import Upload, UploadFile
from app.services.model1_service import model1_service
from app.services.model2_service import model2_service

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/status")
def system_status(db: Session = Depends(get_db)):
    n_cells = db.execute(text("SELECT COUNT(*) FROM prospectivity_features")).scalar_one_or_none() or 0
    n_uploads = db.query(Upload).count()
    return {
        "success": True,
        "model1_loaded": model1_service.is_loaded,
        "model2_loaded": model2_service.is_loaded,
        "prospectivity_grid_cells": n_cells,
        "total_uploads": n_uploads,
    }


@router.get("/uploads")
def list_uploads(db: Session = Depends(get_db)):
    uploads = db.query(Upload).order_by(Upload.created_at.desc()).limit(200).all()
    return {
        "success": True,
        "uploads": [
            {
                "upload_id": u.id,
                "status": u.status,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "detected_crs": u.detected_crs,
            }
            for u in uploads
        ],
    }


@router.get("/uploads/{upload_id}")
def get_upload_detail(upload_id: str, db: Session = Depends(get_db)):
    upload = db.get(Upload, upload_id)
    if upload is None:
        raise UploadNotFoundError(f"Upload {upload_id} not found.")
    files = db.query(UploadFile).filter(UploadFile.upload_id == upload_id).all()
    return {
        "success": True,
        "upload_id": upload.id,
        "status": upload.status,
        "detected_crs": upload.detected_crs,
        "error_message": upload.error_message,
        "files": [{"filename": f.original_filename, "type": f.file_type, "size_bytes": f.size_bytes} for f in files],
    }


@router.delete("/uploads/{upload_id}")
def delete_upload(upload_id: str, db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    upload = db.get(Upload, upload_id)
    if upload is None:
        raise UploadNotFoundError(f"Upload {upload_id} not found.")
    db.query(UploadFile).filter(UploadFile.upload_id == upload_id).delete()
    db.delete(upload)
    db.commit()
    shutil.rmtree(settings.upload_dir / upload_id, ignore_errors=True)
    return {"success": True, "message": f"Upload {upload_id} deleted."}

"""GET /api/documents - the frontend's "GIS Document Repository" view
(frontend/src/views/DocumentsView.tsx expects a plain GISFileItem[] array).

Reads the same uploads/upload_files tables as the admin panel
(app/api/admin.py), but without the admin gate - this is the ordinary
app's document list, not an admin tool."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Upload, UploadFile
from app.schemas.documents import DocumentItem

router = APIRouter(tags=["documents"])

# UploadFile.file_type ("geotiff"|"shapefile"|"csv"|"geojson"|"companion") ->
# GISFileItem.format ("tif"|"shp"|"csv"|"geojson"). Shapefile companion files
# (.dbf/.shx/.prj) have no format of their own and are omitted below.
_FORMAT_MAP = {"geotiff": "tif", "shapefile": "shp", "csv": "csv", "geojson": "geojson"}

# Upload.status ("processing"|"validated"|"failed") -> GISFileItem.status.
# GISFileItem has no "failed" state; "pending" is the closest fit (something
# needs attention before this document is usable).
_STATUS_MAP = {"processing": "validating", "validated": "ready", "failed": "pending"}


def _format_size(size_bytes: int) -> str:
    size = float(size_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} GB"


@router.get("/api/documents", response_model=list[DocumentItem])
def list_documents(db: Session = Depends(get_db)):
    rows = (
        db.query(UploadFile, Upload)
        .join(Upload, Upload.id == UploadFile.upload_id)
        .order_by(UploadFile.created_at.desc())
        .all()
    )

    documents: list[DocumentItem] = []
    for file, upload in rows:
        fmt = _FORMAT_MAP.get(file.file_type)
        if fmt is None:
            continue
        documents.append(
            DocumentItem(
                id=str(file.id),
                name=file.original_filename,
                format=fmt,
                category=file.category or "Uncategorized",
                size=_format_size(file.size_bytes),
                uploaded_at=file.created_at.isoformat() if file.created_at else "",
                status=_STATUS_MAP.get(upload.status, "pending"),
            )
        )
    return documents

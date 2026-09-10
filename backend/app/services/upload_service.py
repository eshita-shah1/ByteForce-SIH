"""Upload session management for the "non-existing study area" workflow.

Handles safe storage (filename sanitization, path-traversal prevention,
size limits, extension allowlisting, safe ZIP extraction for shapefile
bundles), per-file validation, and dataset-level feature-availability
validation. Uploaded data is stored under uploads/<upload_id>/ and is NEVER
merged into the main prospectivity_features table (RULE 7).
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import uuid
import zipfile
from pathlib import Path

from fastapi import UploadFile as FastAPIUploadFile
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.exceptions import DatasetValidationError, UploadNotFoundError
from app.db.models import Upload, UploadFile
from app.ml.model1.feature_schema import get_feature_columns
from app.schemas.upload import DatasetValidationResult, FeatureCheck, FileValidationResult
from app.services import csv_service, raster_service, vector_service
from app.services.feature_service import SourceIndex
from app.utils.validation import sanitize_filename

logger = logging.getLogger("app.upload")

ALLOWED_EXTENSIONS = {".tif", ".tiff", ".shp", ".shx", ".dbf", ".prj", ".cpg", ".csv", ".geojson", ".json", ".zip"}
SHAPEFILE_COMPANIONS = {".shx", ".dbf", ".prj"}


def _classify(filename: str) -> str | None:
    ext = Path(filename).suffix.lower()
    if ext in (".tif", ".tiff"):
        return "geotiff"
    if ext == ".shp":
        return "shapefile"
    if ext == ".csv":
        return "csv"
    if ext in (".geojson", ".json"):
        return "geojson"
    return None


def create_upload(db: Session, settings: Settings) -> str:
    upload_id = uuid.uuid4().hex
    upload_dir = settings.upload_dir / upload_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    upload = Upload(
        id=upload_id,
        status="processing",
        created_at=dt.datetime.utcnow(),
        expires_at=dt.datetime.utcnow() + dt.timedelta(hours=settings.upload_ttl_hours),
    )
    db.add(upload)
    db.commit()
    return upload_id


def _safe_extract_zip(zip_path: Path, dest_dir: Path) -> list[Path]:
    extracted: list[Path] = []
    with zipfile.ZipFile(zip_path) as zf:
        for member in zf.infolist():
            member_name = sanitize_filename(os.path.basename(member.filename))
            if not member_name or member.is_dir():
                continue
            target = dest_dir / member_name
            # Defense in depth against path traversal even though the name
            # was already sanitized to a bare basename above.
            if not str(target.resolve()).startswith(str(dest_dir.resolve())):
                continue
            with zf.open(member) as src, open(target, "wb") as out:
                out.write(src.read())
            extracted.append(target)
    return extracted


async def save_uploaded_files(
    db: Session,
    upload_id: str,
    files: list[FastAPIUploadFile],
    settings: Settings,
    category: str | None = None,
) -> None:
    upload_dir = settings.upload_dir / upload_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    max_bytes = settings.max_upload_size_mb * 1024 * 1024

    for f in files:
        safe_name = sanitize_filename(f.filename or "upload")
        ext = Path(safe_name).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise DatasetValidationError(f"Unsupported file type: {safe_name}", error_code="UNSUPPORTED_FILE_TYPE")

        dest = upload_dir / safe_name
        size = 0
        with open(dest, "wb") as out:
            while chunk := await f.read(1024 * 1024):
                size += len(chunk)
                if size > max_bytes:
                    out.close()
                    dest.unlink(missing_ok=True)
                    raise DatasetValidationError(
                        f"{safe_name} exceeds the {settings.max_upload_size_mb}MB upload limit.",
                        error_code="FILE_TOO_LARGE",
                    )
                out.write(chunk)

        if ext == ".zip":
            extracted = _safe_extract_zip(dest, upload_dir)
            dest.unlink(missing_ok=True)
            for path in extracted:
                file_type = _classify(path.name)
                if file_type or path.suffix.lower() in SHAPEFILE_COMPANIONS:
                    db.add(
                        UploadFile(
                            upload_id=upload_id,
                            original_filename=path.name,
                            stored_path=str(path),
                            file_type=file_type or "companion",
                            size_bytes=path.stat().st_size,
                            category=category,
                        )
                    )
        else:
            file_type = _classify(safe_name)
            if file_type is None and ext not in SHAPEFILE_COMPANIONS:
                dest.unlink(missing_ok=True)
                raise DatasetValidationError(f"Unsupported file type: {safe_name}", error_code="UNSUPPORTED_FILE_TYPE")
            db.add(
                UploadFile(
                    upload_id=upload_id,
                    original_filename=safe_name,
                    stored_path=str(dest),
                    file_type=file_type or "companion",
                    size_bytes=size,
                    category=category,
                )
            )

    db.commit()


def get_upload(db: Session, upload_id: str) -> Upload:
    upload = db.get(Upload, upload_id)
    if upload is None:
        raise UploadNotFoundError(f"Upload {upload_id} not found.")
    return upload


def get_upload_files(db: Session, upload_id: str) -> list[UploadFile]:
    return db.query(UploadFile).filter(UploadFile.upload_id == upload_id).all()


def validate_upload(db: Session, upload_id: str) -> DatasetValidationResult:
    upload = get_upload(db, upload_id)
    files = get_upload_files(db, upload_id)

    file_results: list[FileValidationResult] = []
    shapefile_bases = {f.original_filename[:-4] for f in files if f.file_type == "shapefile"}
    companion_exts = {
        base: {Path(f.original_filename).suffix.lower() for f in files if f.original_filename.startswith(base)}
        for base in shapefile_bases
    }

    for f in files:
        if f.file_type == "geotiff":
            result, _ = raster_service.inspect_geotiff(f.stored_path, f.original_filename)
        elif f.file_type == "shapefile":
            base = f.original_filename[:-4]
            missing = {".shx", ".dbf"} - companion_exts.get(base, set())
            result, _ = vector_service.inspect_vector(f.stored_path, f.original_filename, "shapefile")
            if missing:
                result.errors.append(f"Missing required companion file(s): {sorted(missing)}")
                result.readable = False
            if ".prj" not in companion_exts.get(base, set()):
                result.warnings.append("Missing .prj file; CRS may be unreliable.")
        elif f.file_type == "geojson":
            result, _ = vector_service.inspect_vector(f.stored_path, f.original_filename, "geojson")
        elif f.file_type == "csv":
            result, _, _, _ = csv_service.inspect_csv(f.stored_path, f.original_filename)
        else:
            continue
        file_results.append(result)

    has_blocking_error = any(not r.readable for r in file_results)

    available_features: list[str] = []
    missing_features: list[str] = []
    feature_checks: list[FeatureCheck] = []

    if not has_blocking_error and files:
        index = SourceIndex(files)
        for feature in get_feature_columns():
            match = index.find_source(feature)
            if match:
                kind, source, column = match
                available_features.append(feature)
                feature_checks.append(
                    FeatureCheck(feature=feature, found=True, source_file=source["filename"], method=kind)
                )
            else:
                missing_features.append(feature)
                feature_checks.append(FeatureCheck(feature=feature, found=False))

    status = "failed" if has_blocking_error else "validated"
    ready = not has_blocking_error and not missing_features

    result = DatasetValidationResult(
        upload_id=upload_id,
        status=status,
        files=file_results,
        feature_checks=feature_checks,
        available_features=available_features,
        missing_features=missing_features,
        ready_for_prediction=ready,
        error_message=None if not has_blocking_error else "One or more files failed validation.",
    )

    upload.status = status
    upload.available_features_json = json.dumps(available_features)
    upload.missing_features_json = json.dumps(missing_features)
    upload.validation_result_json = result.model_dump_json()
    if file_results:
        crs_values = {r.detected_crs for r in file_results if r.detected_crs}
        upload.detected_crs = next(iter(crs_values)) if len(crs_values) == 1 else "; ".join(sorted(crs_values))
        all_bounds = [r.bounds for r in file_results if r.bounds]
        if all_bounds:
            upload.bounds_json = json.dumps(
                [
                    min(b[0] for b in all_bounds),
                    min(b[1] for b in all_bounds),
                    max(b[2] for b in all_bounds),
                    max(b[3] for b in all_bounds),
                ]
            )
    db.commit()

    return result

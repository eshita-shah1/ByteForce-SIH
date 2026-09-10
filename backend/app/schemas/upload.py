from __future__ import annotations

from pydantic import BaseModel


class UploadCreateResponse(BaseModel):
    success: bool = True
    upload_id: str
    status: str


class FeatureCheck(BaseModel):
    feature: str
    found: bool
    source_file: str | None = None
    source_layer: str | None = None
    method: str | None = None  # e.g. "raster_sample", "vector_join", "csv_column", "fallback"
    note: str | None = None


class FileValidationResult(BaseModel):
    filename: str
    file_type: str
    readable: bool
    detected_crs: str | None = None
    bounds: list[float] | None = None  # [minx, miny, maxx, maxy] in EPSG:4326
    errors: list[str] = []
    warnings: list[str] = []


class DatasetValidationResult(BaseModel):
    upload_id: str
    status: str  # processing|validated|failed
    files: list[FileValidationResult]
    feature_checks: list[FeatureCheck]
    available_features: list[str]
    missing_features: list[str]
    covers_selected_point: bool | None = None
    ready_for_prediction: bool
    error_message: str | None = None


class UploadStatusResponse(BaseModel):
    success: bool = True
    upload_id: str
    status: str
    detected_crs: str | None = None
    bounds: list[float] | None = None
    available_features: list[str] = []
    missing_features: list[str] = []
    files: list[str] = []
    validation: DatasetValidationResult | None = None

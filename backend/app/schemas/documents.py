from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class DocumentItem(BaseModel):
    """Shaped to match frontend/src/types/index.ts's GISFileItem exactly
    (camelCase JSON via aliases, so the Python side can stay snake_case).
    One row per uploaded file (app.db.models.UploadFile), backing
    GET /api/documents."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    format: Literal["tif", "shp", "csv", "geojson"]
    category: str
    size: str
    uploaded_at: str = Field(alias="uploadedAt")
    status: Literal["ready", "validating", "uploading", "pending"]

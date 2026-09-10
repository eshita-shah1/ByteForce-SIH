from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ProspectivityRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

    @field_validator("latitude", "longitude")
    @classmethod
    def _finite(cls, v: float) -> float:
        if v != v:  # NaN check without importing math
            raise ValueError("Coordinate must be a finite number.")
        return v


class ProspectivityLocation(BaseModel):
    latitude: float
    longitude: float


class ProspectivityResponse(BaseModel):
    success: bool = True
    location: ProspectivityLocation
    prediction: Literal["manganese_present", "manganese_absent"]
    probability: float
    decision_threshold: float
    data_source: Literal["existing_study_area", "uploaded_dataset"]
    matched_cell_id: str | None = None
    match_distance_m: float | None = None
    features_used: list[str]


class StudyAreaResponse(BaseModel):
    type: str = "FeatureCollection"
    features: list[dict]
    source: str
    n_grid_cells: int
    cell_size_m: float

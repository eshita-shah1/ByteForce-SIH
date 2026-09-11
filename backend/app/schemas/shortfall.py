"""Module 2 request/response schemas (v2 model - see
app.ml.model2.feature_schema for the artifact-replacement history).

Field names and required-ness mirror the verified pipeline input contract in
app.ml.model2.feature_schema.
"""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from app.ml.model2.feature_schema import CATEGORICAL_FEATURES
from app.schemas.shortfall_report import ShortfallReportData


class ShortfallRequest(BaseModel):
    # --- identity / timing ---
    timestamp: str = Field(..., description="ISO-8601 datetime; used to derive month/day_of_week.")
    shift_type: str
    pit_id: str

    # --- targets / schedule ---
    # 150-600 tonnes/shift, per explicit product decision. NOTE: no training
    # dataset for this artifact exists in this repository, so this range is
    # NOT verified against the model's actual training distribution - see
    # app.ml.model2.feature_schema and the 2026-09-11 negative-prediction
    # audit (a black-box characterization across this exact range found
    # predictions are negative for effectively all realistic inputs in it).
    target_production_tonnes: float = Field(..., ge=150, le=600)
    planned_operating_hours: float = Field(..., ge=0)

    # --- environmental (optionally auto-filled from live weather/soil data; see feature_sources) ---
    rainfall_intensity_mm: float | None = Field(default=None, ge=0)
    cumulative_rainfall_72h: float | None = Field(default=None, ge=0)
    soil_moisture_index: float | None = Field(default=None, ge=0)
    surface_water_pooling_pct: float = Field(..., ge=0, le=100)

    # --- operational ---
    excavators_available: int = Field(..., ge=0)
    dump_trucks_operational: int = Field(..., ge=0)
    workers_scheduled: int = Field(..., ge=0)
    workers_available: int = Field(..., ge=0)
    previous_shift_production_tonnes: float = Field(..., ge=0)
    previous_day_production_tonnes: float = Field(..., ge=0)

    @field_validator("shift_type")
    @classmethod
    def _valid_shift(cls, v: str) -> str:
        allowed = CATEGORICAL_FEATURES["shift_type"]
        if v not in allowed:
            raise ValueError(f"shift_type must be one of {allowed}")
        return v

    @field_validator("pit_id")
    @classmethod
    def _valid_pit(cls, v: str) -> str:
        allowed = CATEGORICAL_FEATURES["pit_id"]
        if v not in allowed:
            raise ValueError(f"pit_id must be one of {allowed}")
        return v


class CorrectiveMeasure(BaseModel):
    factor: str
    severity: str  # "high" | "medium" | "low"
    action: str
    reason: str


class ShortfallResponse(BaseModel):
    success: bool = True
    pit_id: str
    shift_type: str
    target_production_tonnes: float
    predicted_production_tonnes: float
    shortfall_tonnes: float
    shortfall_percentage: float
    risk: str  # Normal | Alert | Critical
    primary_causes: list[str]
    corrective_measures: list[CorrectiveMeasure]
    feature_sources: dict[str, str]
    # Frontend-shaped report (see app/services/shortfall_report.py) - additive,
    # existing consumers of this response are unaffected.
    report: ShortfallReportData | None = None

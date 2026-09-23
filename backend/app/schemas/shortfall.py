"""Module 2 request/response schemas (v3 model, 2026-09-22 - see
app.ml.model2.feature_schema for the artifact-replacement history).

Field names and required-ness mirror the verified v3 input contract:
models/model2_features.json (loaded by app/services/model2_service.py) for
the 15 model features, plus pit_id/shift_type/timestamp which the model no
longer consumes but the report/site-selection/run-log still need.
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
    # 400-600 tonnes/shift, 2026-09-22: this is the ACTUAL observed range of
    # target_production_tonnes in the v3 training dataset shipped alongside
    # the new model (backend/data/model2_training_dataset_v2.csv, 5,000
    # rows: min=400.0, max=599.9) - not a guess or a re-run of the old v2
    # characterization sweep. The old v2 window (500-700) doesn't apply to
    # v3: it was derived from v2's own output behavior and would let
    # requests up to 700 extrapolate ~17% past this model's actual training
    # ceiling. predict_shortfall() applies a target-recentering correction
    # to Model 2's raw output for v3 too (MODEL2_TARGET_RECENTERING_TONNES,
    # re-derived 2026-09-22 from this same dataset via an 80/20 holdout
    # split - see shortfall_service.py), which keeps predicted tonnage
    # positive across this whole range; a physical floor at 0 remains as a
    # defensive safeguard regardless.
    target_production_tonnes: float = Field(..., ge=400, le=600)
    planned_operating_hours: float = Field(..., ge=0)

    # --- environmental (optionally auto-filled from live weather/soil data; see feature_sources) ---
    rainfall_intensity_mm: float | None = Field(default=None, ge=0)
    cumulative_rainfall_72h: float | None = Field(default=None, ge=0)
    soil_moisture_index: float | None = Field(default=None, ge=0)
    surface_water_pooling_pct: float = Field(..., ge=0, le=100)
    # --- new in v3 (2026-09-22): both are live-sourceable from Open-Meteo,
    # same override policy as the fields above - see feature_sources.
    humidity_pct: float | None = Field(default=None, ge=0, le=100)
    land_surface_temperature_c: float | None = Field(default=None)

    # --- operational ---
    excavators_available: int = Field(..., ge=0)
    dump_trucks_operational: int = Field(..., ge=0)
    workers_scheduled: int = Field(..., ge=0)
    workers_available: int = Field(..., ge=0)
    previous_shift_production_tonnes: float = Field(..., ge=0)
    previous_day_production_tonnes: float = Field(..., ge=0)
    # --- new in v3 (2026-09-22): no live source exists for either - always
    # user-supplied, like the other operational fields above.
    equipment_downtime_hours: float = Field(..., ge=0)
    dumper_cycle_time_minutes: float = Field(..., ge=0)

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


class ShapContribution(BaseModel):
    feature: str
    value: float
    shap_value: float
    direction: str  # "increases_prediction" | "decreases_prediction"


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
    # Model 2 artifact identifier, for reports/logs - additive.
    model_version: str = "model2_xgboost_production (v3, 2026-09-22)"
    # Real SHAP TreeExplainer output for this exact prediction, top features
    # by |shap_value| - None only if the explainer failed to load at
    # startup (see model2_service.py); never fabricated. Additive.
    shap_explanation: list[ShapContribution] | None = None
    # Frontend-shaped report (see app/services/shortfall_report.py) - additive,
    # existing consumers of this response are unaffected.
    report: ShortfallReportData | None = None

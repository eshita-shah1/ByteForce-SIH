"""Builds the frontend's ShortfallReportData shape (RunLog.reportRef and
POST /api/shortfall's optional `report` field) from real ShortfallRequest/
ShortfallResponse values only.

Two fields have no corresponding concept anywhere in Model 2's feature set
and are labeled as such rather than invented: lightning risk and
groundwater/water-table depth. Everything else is either a direct pass-
through of a real value, or a deterministic derivation from one (documented
inline) - never a fabricated fact.
"""
from __future__ import annotations

import datetime as dt
import uuid

from app.ml.model2.feature_schema import PIT_COORDINATES
from app.schemas.shortfall import ShortfallRequest, ShortfallResponse
from app.schemas.shortfall_report import (
    ShortfallReportContributingFactor,
    ShortfallReportCoordinates,
    ShortfallReportData,
    ShortfallReportEnvironmental,
    ShortfallReportSubmittedParameters,
)

_RISK_LEVEL_MAP = {"Normal": "LOW", "Alert": "MODERATE RISK", "Critical": "HIGH RISK"}
_SEVERITY_WEIGHT = {"high": 3, "medium": 2, "low": 1}
_NOT_MODELED = "Not modeled by this system (no such feature exists in Model 2)."


def _humanize(identifier: str) -> str:
    return identifier.replace("_", " ").title()


def _weather_temp_text(request: ShortfallRequest, response: ShortfallResponse) -> str:
    if request.land_surface_temperature_c is not None:
        return f"{request.land_surface_temperature_c:.1f}°C (user-supplied)"
    if response.feature_sources.get("land_surface_temperature_c") == "weather_api":
        return "Sourced live from weather API (exact value not returned by this endpoint)."
    return "Not available."


def _rainfall_text(request: ShortfallRequest, response: ShortfallResponse) -> str:
    value = request.rainfall_intensity_mm
    if value is not None:
        if value >= 25:
            return f"Rainfall intensity is {value:.1f}mm/hr, at/above the 25mm heavy-rain threshold."
        return f"Rainfall intensity is {value:.1f}mm/hr - within normal range."
    if response.feature_sources.get("rainfall_intensity_mm") == "weather_api":
        return "Sourced live from weather API (exact value not returned by this endpoint)."
    return "Not available."


def _haul_road_slippage_text(request: ShortfallRequest) -> str:
    value = request.haul_road_condition_index
    if value < 3:
        return f"Haul-road condition index is {value:.1f}, below the 3.0 threshold - maintenance advised."
    return f"Haul-road condition index is {value:.1f} - within normal range."


def build_shortfall_report(request: ShortfallRequest, response: ShortfallResponse) -> ShortfallReportData:
    lat, lng = PIT_COORDINATES[request.pit_id]

    weights = [_SEVERITY_WEIGHT.get(m.severity, 1) for m in response.corrective_measures]
    total_weight = sum(weights)
    contributing_factors = [
        ShortfallReportContributingFactor(
            name=_humanize(measure.factor),
            description=measure.reason,
            # Severity-based weighting (high=3/medium=2/low=1), normalized
            # across the causes actually flagged for this run - a documented
            # display convention, not a model-computed sensitivity (Model 2
            # doesn't produce per-factor sensitivities).
            impact_percent=round(weight / total_weight * 100),
        )
        for measure, weight in zip(response.corrective_measures, weights)
    ]

    return ShortfallReportData(
        id=uuid.uuid4().hex,
        site_name=_humanize(request.pit_id),
        coordinates=ShortfallReportCoordinates(lat=lat, lng=lng),
        computed_ago="Just now",
        timestamp=dt.datetime.utcnow().isoformat(),
        expected_shortfall_percent=response.shortfall_percentage,
        risk_level=_RISK_LEVEL_MAP[response.risk],
        target_production_tonnes=response.target_production_tonnes,
        predicted_output_tonnes=response.predicted_production_tonnes,
        expected_gap_tonnes=response.shortfall_tonnes,
        environmental=ShortfallReportEnvironmental(
            weather_temp=_weather_temp_text(request, response),
            storm_risk=_rainfall_text(request, response),
            lightning_risk=_NOT_MODELED,
            water_table_depth=_NOT_MODELED,
            water_table_risk=_NOT_MODELED,
            haul_road_status=f"Haul-road condition index: {request.haul_road_condition_index:.1f}",
            haul_road_slippage=_haul_road_slippage_text(request),
        ),
        submitted_parameters=ShortfallReportSubmittedParameters(
            target_site=_humanize(request.pit_id),
            target_extraction=f"{response.target_production_tonnes:,.0f} tonnes",
            shift_crews_active=f"{request.workers_available} workers available ({request.shift_type.replace('_', ' ')})",
            haulage_fleet=f"{request.dump_trucks_operational}/{request.dump_trucks_assigned} dump trucks operational",
            blasting_scheduled="Yes" if request.blasting_scheduled_flag else "No",
            geological_profile="Not assessed by this model (Module 2 is operational, not geological - see Module 1 / prospectivity for that).",
        ),
        contributing_factors=contributing_factors,
        corrective_measures=[m.action for m in response.corrective_measures],
    )

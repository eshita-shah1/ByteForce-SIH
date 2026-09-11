"""Builds the frontend's ShortfallReportData shape (RunLog.reportRef and
POST /api/shortfall's optional `report` field) from real ShortfallRequest/
ShortfallResponse values only.

v2 model note: haul-road condition and blasting scheduling are no longer
Model 2 features (see app.ml.model2.feature_schema) - those two report
slots are now labeled "not modeled" rather than invented, same as lightning
risk and groundwater/water-table depth (which never had a source). The
"climate" slot now surfaces soil_moisture_index (a real, still-present
feature) instead of the removed land_surface_temperature_c. Everything
else is either a direct pass-through of a real value, or a deterministic
derivation from one (documented inline) - never a fabricated fact.

The Hydrology and Logistics cards on the frontend each render two of these
"not modeled" fields stacked (headline + detail line); see
_NOT_MODELED_DETAIL below for why the detail line is left empty rather
than repeating the same "not modeled" sentence directly underneath itself.
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
# The Hydrology and Logistics report cards each render two fields stacked
# (a bold headline, then a lighter detail line below it). water_table_depth/
# haul_road_status feed the headline and water_table_risk/haul_road_slippage
# feed the detail line - but both fields in each pair point at the SAME
# dropped v2 feature (there's no separate "depth" vs. "risk" data to report
# for a feature that was never modeled). The full disclosure goes in the
# headline; the detail line is left empty (the frontend hides an empty
# detail line rather than rendering a second, redundant "not modeled"
# sentence directly underneath the first).
_NOT_MODELED_DETAIL = ""


def _humanize(identifier: str) -> str:
    return identifier.replace("_", " ").title()


def _soil_moisture_text(request: ShortfallRequest, response: ShortfallResponse) -> str:
    value = request.soil_moisture_index
    if value is not None:
        return f"Soil moisture index: {value:.1f} (user-supplied)"
    if response.feature_sources.get("soil_moisture_index") == "weather_api":
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
            weather_temp=_soil_moisture_text(request, response),
            storm_risk=_rainfall_text(request, response),
            lightning_risk=_NOT_MODELED,
            water_table_depth=_NOT_MODELED,
            water_table_risk=_NOT_MODELED_DETAIL,
            haul_road_status=_NOT_MODELED,
            haul_road_slippage=_NOT_MODELED_DETAIL,
        ),
        submitted_parameters=ShortfallReportSubmittedParameters(
            target_site=_humanize(request.pit_id),
            target_extraction=f"{response.target_production_tonnes:,.0f} tonnes",
            shift_crews_active=f"{request.workers_available} workers available ({request.shift_type.replace('_', ' ')})",
            haulage_fleet=f"{request.dump_trucks_operational} dump trucks operational",
            blasting_scheduled=_NOT_MODELED,
            geological_profile="Not assessed by this model (Module 2 is operational, not geological - see Module 1 / prospectivity for that).",
        ),
        contributing_factors=contributing_factors,
        corrective_measures=[m.action for m in response.corrective_measures],
    )

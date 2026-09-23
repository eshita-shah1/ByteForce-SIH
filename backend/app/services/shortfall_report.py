"""Builds the frontend's ShortfallReportData shape (RunLog.reportRef and
POST /api/shortfall's optional `report` field) from real ShortfallRequest/
ShortfallResponse values only.

v2 model note: water-table depth/risk, haul-road status/slippage, and
blasting-schedule were all dropped entirely (from ShortfallReportEnvironmental/
ShortfallReportSubmittedParameters and from the frontend cards/fields that
displayed them) rather than kept around as permanent "not modeled"
placeholders - v2's Model 2 pipeline has no such features at all, so there
was nothing for those slots to ever report. lightning_risk is the one
remaining "not modeled" slot (no source ever existed for it, in v1 or v2).
The "climate" slot surfaces soil_moisture_index (a real, still-present
feature) instead of the removed land_surface_temperature_c. Everything else
is either a direct pass-through of a real value, or a deterministic
derivation from one (documented inline) - never a fabricated fact.

v3 model note (2026-09-22): land_surface_temperature_c and humidity_pct
are back as real v3 inputs (see app/ml/model2/feature_schema.py), but the
"climate" slot's wording is left as-is (still soil moisture) rather than
restructured, since it remains accurate and existing frontend/tests key on
it. Both new fields are covered instead by model_explanation (real SHAP
output, added below) when they're among the top contributing features for
a given prediction.
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
    ShortfallReportShapFactor,
    ShortfallReportSubmittedParameters,
)

_RISK_LEVEL_MAP = {"Normal": "LOW", "Alert": "MODERATE RISK", "Critical": "HIGH RISK"}
_SEVERITY_WEIGHT = {"high": 3, "medium": 2, "low": 1}
_NOT_MODELED = "Not modeled by this system (no such feature exists in Model 2)."


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

    model_explanation = (
        [ShortfallReportShapFactor(**c.model_dump()) for c in response.shap_explanation]
        if response.shap_explanation is not None
        else None
    )

    return ShortfallReportData(
        id=uuid.uuid4().hex,
        site_name=_humanize(request.pit_id),
        coordinates=ShortfallReportCoordinates(lat=lat, lng=lng),
        computed_ago="Just now",
        timestamp=dt.datetime.utcnow().isoformat(),
        model_version=response.model_version,
        expected_shortfall_percent=response.shortfall_percentage,
        risk_level=_RISK_LEVEL_MAP[response.risk],
        target_production_tonnes=response.target_production_tonnes,
        predicted_output_tonnes=response.predicted_production_tonnes,
        expected_gap_tonnes=response.shortfall_tonnes,
        environmental=ShortfallReportEnvironmental(
            weather_temp=_soil_moisture_text(request, response),
            storm_risk=_rainfall_text(request, response),
            lightning_risk=_NOT_MODELED,
        ),
        submitted_parameters=ShortfallReportSubmittedParameters(
            target_site=_humanize(request.pit_id),
            target_extraction=f"{response.target_production_tonnes:,.0f} tonnes",
            shift_crews_active=f"{request.workers_available} workers available ({request.shift_type.replace('_', ' ')})",
            haulage_fleet=f"{request.dump_trucks_operational} dump trucks operational",
            geological_profile="Not assessed by this model (Module 2 is operational, not geological - see Module 1 / prospectivity for that).",
        ),
        contributing_factors=contributing_factors,
        corrective_measures=[m.action for m in response.corrective_measures],
        model_explanation=model_explanation,
    )

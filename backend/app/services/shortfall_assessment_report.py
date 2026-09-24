"""Builds the detailed Model 2 "Manganese Production Shortfall Assessment"
report from the existing, already-computed prediction + SHAP output only -
never a second prediction, never a recomputed/different SHAP calculation,
never a fabricated value. See shortfall_service.py for where the single
model2_service.explain() call that feeds both this report AND the existing
top-5 ShortfallResponse.shap_explanation field happens.

Two clearly separated layers, per the explicit design requirement:
  - "Why did the model produce this result?": the top 5 SHAP contributors
    by |shap_value| (already sorted that way by model2_service.explain()),
    each with a direction-aware, hedged explanation. Never claims proven
    physical causation - always "contributed to"/"influenced the
    prediction", matching the explicit wording constraint.
  - "Recommended Corrective Measures": generated ONLY for features that are
    BOTH (a) negative SHAP contributors for this exact prediction and (b) in
    ACTIONABLE_FEATURES below - target_production_tonnes and the two
    previous-production fields are explicitly excluded as contextual/
    planning inputs, not operational levers, per the same explicit
    requirement. Scans the FULL 15-feature contribution list (not just the
    displayed top 5), since an actionable feature's negative contribution
    can be real and worth acting on even if it isn't in the top 5 by
    magnitude for this particular prediction.

FEATURE_LABELS and _CORRECTIVE_MEASURES are a small, explicit, hand-written
mapping for exactly these 15 features - not inferred from an external
manifest (none exists for Model 2's features, unlike Model 1's), and not
domain interpretations beyond what each variable name already self-evidently
means. 8 of the 12 actionable features' corrective-measure text and the
positive/negative wording style were given directly; the remaining 4
(workers_scheduled, planned_operating_hours, humidity_pct,
land_surface_temperature_c) were written to match that same tone/pattern -
procedural guidance only, no invented numeric thresholds.
"""
from __future__ import annotations

from app.schemas.shortfall import ShortfallResponse
from app.schemas.shortfall_assessment_report import (
    CorrectiveMeasureItem,
    ProductionSummary,
    RecommendedCorrectiveMeasures,
    ShortfallAssessmentReport,
    WhyFactor,
    WhyModelProducedResult,
)

FEATURE_LABELS: dict[str, str] = {
    "workers_available": "Workers Available",
    "workers_scheduled": "Workers Scheduled",
    "excavators_available": "Excavators Available",
    "dump_trucks_operational": "Dump Trucks Operational",
    "equipment_downtime_hours": "Equipment Downtime",
    "planned_operating_hours": "Planned Operating Hours",
    "dumper_cycle_time_minutes": "Dumper Cycle Time",
    "cumulative_rainfall_72h": "Cumulative Rainfall (72h)",
    "humidity_pct": "Humidity",
    "land_surface_temperature_c": "Land Surface Temperature",
    "soil_moisture_index": "Soil Moisture Index",
    "surface_water_pooling_pct": "Surface Water Pooling",
    "previous_shift_production_tonnes": "Previous Shift Production",
    "previous_day_production_tonnes": "Previous Day Production",
    "target_production_tonnes": "Target Production",
}

# Contextual/planning inputs the model consumes but which are not
# operational levers - explicitly excluded from corrective-measure
# generation regardless of SHAP direction, per the explicit requirement.
_CONTEXTUAL_FEATURES = {
    "target_production_tonnes",
    "previous_shift_production_tonnes",
    "previous_day_production_tonnes",
}

ACTIONABLE_FEATURES = {
    "workers_available",
    "workers_scheduled",
    "excavators_available",
    "dump_trucks_operational",
    "equipment_downtime_hours",
    "planned_operating_hours",
    "dumper_cycle_time_minutes",
    "cumulative_rainfall_72h",
    "humidity_pct",
    "land_surface_temperature_c",
    "soil_moisture_index",
    "surface_water_pooling_pct",
}

_CORRECTIVE_MEASURES: dict[str, str] = {
    "equipment_downtime_hours": (
        "Prioritize maintenance and rapid breakdown resolution for equipment contributing to downtime. "
        "Review recurring failure patterns and schedule preventive maintenance where appropriate."
    ),
    "dumper_cycle_time_minutes": (
        "Investigate loading, hauling, dumping, queuing and return delays contributing to longer cycle "
        "times. Optimize haul routes and equipment coordination where operationally feasible."
    ),
    "excavators_available": (
        "Check excavator availability and prioritize maintenance or replacement of unavailable units. "
        "Review equipment allocation to avoid excavation-capacity constraints."
    ),
    "dump_trucks_operational": (
        "Inspect non-operational dump trucks and prioritize breakdown resolution. Rebalance available "
        "hauling capacity where possible to reduce transport constraints."
    ),
    "workers_available": (
        "Review workforce availability against shift requirements and address avoidable manpower gaps. "
        "Reallocate available personnel where operationally appropriate."
    ),
    "workers_scheduled": (
        "Review shift workforce scheduling against planned production requirements to ensure staffing "
        "levels are appropriately matched to the shift's workload."
    ),
    "planned_operating_hours": (
        "Review planned operating-hours scheduling for the shift and address avoidable reductions to "
        "the available production window where operationally feasible."
    ),
    "cumulative_rainfall_72h": (
        "Account for recent rainfall when planning operations and prioritize safe, accessible working "
        "and haulage areas. Inspect affected haul roads and drainage conditions."
    ),
    "soil_moisture_index": (
        "Monitor ground conditions when soil moisture is elevated and prioritize stable, accessible "
        "operating areas."
    ),
    "surface_water_pooling_pct": (
        "Address avoidable water accumulation and inspect drainage around operating and haulage areas."
    ),
    "humidity_pct": (
        "Account for elevated humidity when planning shift operations, and monitor equipment and "
        "material-handling processes for humidity-related effects where relevant."
    ),
    "land_surface_temperature_c": (
        "Account for elevated surface temperature conditions when planning shift operations and "
        "monitor for related equipment or workforce impacts where relevant."
    ),
}

# feature -> {"positive": ..., "negative": ...}. Hedged, direction-aware,
# never a proven-causation claim - "can"/"may"/"is associated with", matching
# the explicit wording constraint (never "caused exactly X tonnes of loss").
_EXPLANATION_TEMPLATES: dict[str, dict[str, str]] = {
    "workers_available": {
        "positive": "Higher worker availability contributed positively to the model's prediction. Adequate staffing can support fuller execution of planned production activities.",
        "negative": "Lower worker availability contributed negatively to the model's prediction. Reduced staffing can constrain the pace of planned production activities.",
    },
    "workers_scheduled": {
        "positive": "The number of workers scheduled contributed positively to the model's prediction, consistent with a shift plan sized to support the target production level.",
        "negative": "The number of workers scheduled contributed negatively to the model's prediction. A scheduling mismatch relative to the shift's workload can influence predicted output.",
    },
    "excavators_available": {
        "positive": "Excavator availability contributed positively to the model's prediction. More available excavation capacity can support higher material throughput.",
        "negative": "Excavator availability contributed negatively to the model's prediction. Reduced excavation capacity can limit the material feed available for hauling.",
    },
    "dump_trucks_operational": {
        "positive": "The number of operational dump trucks contributed positively to the model's prediction. Greater hauling capacity can support more completed production cycles.",
        "negative": "The number of operational dump trucks contributed negatively to the model's prediction. Reduced hauling capacity can constrain how much material is moved during the shift.",
    },
    "equipment_downtime_hours": {
        "positive": "Equipment downtime contributed positively to the model's prediction; downtime was comparatively low relative to this input combination.",
        "negative": "Equipment downtime contributed negatively to the model's prediction. Time lost to equipment breakdowns or servicing can reduce the production time actually available during the shift.",
    },
    "planned_operating_hours": {
        "positive": "Planned operating hours contributed positively to the model's prediction. A longer planned shift window can support higher achievable output.",
        "negative": "Planned operating hours contributed negatively to the model's prediction. A shorter planned operating window can limit the achievable production for the shift.",
    },
    "dumper_cycle_time_minutes": {
        "positive": "Dumper cycle time contributed positively to the model's prediction, consistent with efficient haul-cycle timing for this shift.",
        "negative": "The longer dumper cycle time contributed negatively to the predicted production. Longer cycles can reduce the number of hauling cycles completed during the shift.",
    },
    "cumulative_rainfall_72h": {
        "positive": "Cumulative rainfall over the past 72 hours contributed positively to the model's prediction for this input combination.",
        "negative": "Cumulative rainfall over the past 72 hours contributed negatively to the model's prediction. Sustained rainfall can affect haul-road and pit conditions in ways that influence achievable production.",
    },
    "humidity_pct": {
        "positive": "Humidity contributed positively to the model's prediction for this input combination.",
        "negative": "Humidity contributed negatively to the model's prediction. Elevated humidity can be associated with operating conditions that influence achievable production.",
    },
    "land_surface_temperature_c": {
        "positive": "Land surface temperature contributed positively to the model's prediction for this input combination.",
        "negative": "Land surface temperature contributed negatively to the model's prediction. Elevated surface temperatures can be associated with operating conditions that influence achievable production.",
    },
    "soil_moisture_index": {
        "positive": "Soil moisture contributed positively to the model's prediction for this input combination.",
        "negative": "Soil moisture contributed negatively to the model's prediction. Elevated soil moisture can affect ground stability and trafficability in ways that influence achievable production.",
    },
    "surface_water_pooling_pct": {
        "positive": "Surface water pooling contributed positively to the model's prediction for this input combination.",
        "negative": "Surface water pooling contributed negatively to the model's prediction. Pooled water on operating or haulage surfaces can restrict safe access and vehicle movement.",
    },
    "previous_shift_production_tonnes": {
        "positive": "Previous shift production contributed positively to the model's prediction. This is a contextual/historical input the model uses as a reference point, not an operational factor that can itself be adjusted for this shift.",
        "negative": "Previous shift production contributed negatively to the model's prediction. This is a contextual/historical input the model uses as a reference point, not an operational factor that can itself be adjusted for this shift.",
    },
    "previous_day_production_tonnes": {
        "positive": "Previous day production contributed positively to the model's prediction. This is a contextual/historical input the model uses as a reference point, not an operational factor that can itself be adjusted for this shift.",
        "negative": "Previous day production contributed negatively to the model's prediction. This is a contextual/historical input the model uses as a reference point, not an operational factor that can itself be adjusted for this shift.",
    },
    "target_production_tonnes": {
        "positive": "Target production contributed positively to the model's prediction. This is a planning input reflecting the production goal set for this shift, not a physical operational cause of the predicted outcome, and should not be interpreted as such.",
        "negative": "Target production contributed negatively to the model's prediction. This is a planning input reflecting the production goal set for this shift, not a physical operational cause of the predicted outcome, and should not be interpreted as such.",
    },
}

_NO_ACTIONABLE_NEGATIVE_NOTE = (
    "No major actionable operational feature showed a negative SHAP contribution among the monitored "
    "inputs. Continue planned operations and monitor actual production against the predicted output."
)


def _label(feature: str) -> str:
    return FEATURE_LABELS.get(feature, feature)


def _direction(shap_value: float) -> str:
    return "positive" if shap_value >= 0 else "negative"


def _explanation(feature: str, direction: str) -> str:
    templates = _EXPLANATION_TEMPLATES.get(feature)
    if templates is not None:
        return templates[direction]
    # Defensive fallback only - every one of Model 2's 15 features has a
    # template above; this path should not execute against the real model.
    verb = "contributed positively" if direction == "positive" else "contributed negatively"
    return f"{_label(feature)} {verb} to the model's prediction for this input combination."


def build_shortfall_assessment_report(
    response: ShortfallResponse, full_shap_contributions: list[dict] | None
) -> ShortfallAssessmentReport | None:
    if full_shap_contributions is None:
        return None

    production_summary = ProductionSummary(
        target_production_tonnes=response.target_production_tonnes,
        predicted_production_tonnes=response.predicted_production_tonnes,
        shortfall_tonnes=response.shortfall_tonnes,
        shortfall_percentage=response.shortfall_percentage,
        risk_level=response.risk,
    )

    top_five = full_shap_contributions[:5]
    factors = [
        WhyFactor(
            feature=c["feature"],
            label=_label(c["feature"]),
            value=float(c["value"]),
            shap_contribution=c["shap_value"],
            direction=_direction(c["shap_value"]),
            explanation=_explanation(c["feature"], _direction(c["shap_value"])),
        )
        for c in top_five
    ]

    measures = [
        CorrectiveMeasureItem(
            feature=c["feature"],
            label=_label(c["feature"]),
            value=float(c["value"]),
            shap_contribution=c["shap_value"],
            measure=_CORRECTIVE_MEASURES[c["feature"]],
        )
        for c in full_shap_contributions
        if c["shap_value"] < 0 and c["feature"] in ACTIONABLE_FEATURES
    ]
    # Deterministic, strongest-first - matches the "why" section's ordering
    # convention rather than the raw feature-column order.
    measures.sort(key=lambda m: abs(m.shap_contribution), reverse=True)

    return ShortfallAssessmentReport(
        production_summary=production_summary,
        why_model_produced_result=WhyModelProducedResult(factors=factors),
        recommended_corrective_measures=RecommendedCorrectiveMeasures(
            measures=measures,
            note=None if measures else _NO_ACTIONABLE_NEGATIVE_NOTE,
        ),
    )

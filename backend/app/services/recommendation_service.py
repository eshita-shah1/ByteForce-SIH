"""Rule-based corrective-measure engine for Module 2 (shortfall) ONLY.

Rules operate exclusively on Module 2's own raw inputs and the shortfall it
predicted. Model 1 (prospectivity) is never consulted here (RULE 5 / 44).

v2 model note: the v1 artifact's feature set included several fields these
rules used to key on (excavator_downtime_hours, dump_trucks_assigned,
haul_road_condition_index, blasting_delay_hours, muckpile_volume_available,
rock_hardness_ucs, worker_availability_pct). The v2 model (see
app.ml.model2.feature_schema) drops all of them. Rather than inventing new
thresholds for fields with no prior domain-validated cutoff, those 6 rules
were REMOVED (not replaced with guesses). Two rules survive because their
underlying field still exists (rainfall) or can be faithfully recomputed
from fields that still exist (worker availability, from workers_available/
workers_scheduled) using the exact same threshold as before.
"""
from __future__ import annotations

from app.schemas.shortfall import CorrectiveMeasure


def calculate_risk(shortfall_percentage: float) -> str:
    if shortfall_percentage < 10:
        return "Normal"
    if shortfall_percentage < 25:
        return "Alert"
    return "Critical"


def build_recommendations(inputs: dict) -> tuple[list[str], list[CorrectiveMeasure]]:
    causes: list[str] = []
    measures: list[CorrectiveMeasure] = []

    def add(factor: str, severity: str, action: str, reason: str, cause: str) -> None:
        causes.append(cause)
        measures.append(CorrectiveMeasure(factor=factor, severity=severity, action=action, reason=reason))

    if inputs.get("rainfall_intensity_mm") is not None and inputs["rainfall_intensity_mm"] >= 25:
        add(
            "rainfall",
            "medium",
            "Increase drainage/dewatering effort and shift operations to less-affected pit areas.",
            f"Rainfall intensity is {inputs['rainfall_intensity_mm']:.1f}mm, at/above the 25mm threshold.",
            "Heavy rainfall",
        )

    workers_scheduled = inputs["workers_scheduled"]
    if workers_scheduled > 0:
        worker_availability_pct = inputs["workers_available"] / workers_scheduled * 100
        if worker_availability_pct < 90:
            add(
                "worker_availability",
                "high",
                "Reallocate workers/operators to critical production activities.",
                f"Worker availability is {worker_availability_pct:.1f}%, below the 90% threshold.",
                "Low worker availability",
            )

    if not measures:
        causes.append("No major operational issue detected")
        measures.append(
            CorrectiveMeasure(
                factor="none",
                severity="low",
                action="Continue normal operations and monitor production.",
                reason="No monitored factor breached its threshold.",
            )
        )

    return causes, measures

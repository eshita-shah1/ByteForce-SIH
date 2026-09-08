"""Rule-based corrective-measure engine for Module 2 (shortfall) ONLY.

Rules operate exclusively on Module 2's own raw inputs and the shortfall it
predicted. Model 1 (prospectivity) is never consulted here (RULE 5 / 44).
Thresholds mirror the reference main.py that was shipped with the model
files (corrected to the verified field names), since that is the only
domain-expert-authored logic available for this project - not invented
from scratch.
"""
from __future__ import annotations

from app.schemas.shortfall import CorrectiveMeasure


def calculate_risk(shortfall_percentage: float) -> str:
    if shortfall_percentage <= 5:
        return "Normal"
    if shortfall_percentage <= 15:
        return "Alert"
    return "Critical"


_RULES: list[tuple[str, str, str, str]] = [
    # (factor, severity, action, reason) — condition checked in build_recommendations()
]


def build_recommendations(inputs: dict) -> tuple[list[str], list[CorrectiveMeasure]]:
    causes: list[str] = []
    measures: list[CorrectiveMeasure] = []

    def add(factor: str, severity: str, action: str, reason: str, cause: str) -> None:
        causes.append(cause)
        measures.append(CorrectiveMeasure(factor=factor, severity=severity, action=action, reason=reason))

    if inputs["excavator_downtime_hours"] >= 2:
        add(
            "excavator_downtime",
            "high",
            "Deploy a standby excavator and prioritize repair of down units.",
            f"Excavator downtime is {inputs['excavator_downtime_hours']:.1f}h, at/above the 2h threshold.",
            "Excavator downtime",
        )

    if inputs["dump_trucks_assigned"] > 0 and inputs["dump_trucks_operational"] < 0.8 * inputs["dump_trucks_assigned"]:
        add(
            "dump_truck_availability",
            "high",
            "Reallocate or deploy additional dump trucks to restore haulage capacity.",
            f"Only {inputs['dump_trucks_operational']}/{inputs['dump_trucks_assigned']} dump trucks are operational (<80%).",
            "Dump truck availability",
        )

    if inputs.get("rainfall_intensity_mm") is not None and inputs["rainfall_intensity_mm"] >= 25:
        add(
            "rainfall",
            "medium",
            "Increase drainage/dewatering effort and shift operations to less-affected pit areas.",
            f"Rainfall intensity is {inputs['rainfall_intensity_mm']:.1f}mm, at/above the 25mm threshold.",
            "Heavy rainfall",
        )

    if inputs["haul_road_condition_index"] < 3:
        add(
            "haul_road_condition",
            "medium",
            "Prioritize haul-road maintenance and grading before the next shift.",
            f"Haul-road condition index is {inputs['haul_road_condition_index']:.1f}, below the 3.0 threshold.",
            "Poor haul-road condition",
        )

    if inputs["blasting_delay_hours"] >= 1:
        add(
            "blasting_delay",
            "medium",
            "Reschedule blasting and draw down available muckpile in the interim.",
            f"Blasting delay is {inputs['blasting_delay_hours']:.1f}h, at/above the 1h threshold.",
            "Blasting delay",
        )

    if inputs["muckpile_volume_available"] < 500:
        add(
            "muckpile_availability",
            "medium",
            "Increase blasted-ore inventory to maintain a sufficient muckpile buffer.",
            f"Available muckpile is {inputs['muckpile_volume_available']:.1f}, below the 500 threshold.",
            "Low muckpile availability",
        )

    if inputs["worker_availability_pct"] < 90:
        add(
            "worker_availability",
            "high",
            "Reallocate workers/operators to critical production activities.",
            f"Worker availability is {inputs['worker_availability_pct']:.1f}%, below the 90% threshold.",
            "Low worker availability",
        )

    if inputs["rock_hardness_ucs"] > 130:
        add(
            "rock_hardness",
            "low",
            "Optimize drilling and blasting parameters for harder rock.",
            f"Rock hardness (UCS) is {inputs['rock_hardness_ucs']:.1f}, above the 130 threshold.",
            "High rock hardness",
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

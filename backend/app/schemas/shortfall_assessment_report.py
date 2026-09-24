"""Structure mirrors exactly what was requested for the Model 2 detailed
assessment report (2026): report_type / production_summary /
why_model_produced_result / recommended_corrective_measures. Built entirely
from the existing, already-computed ShortfallResponse prediction and SHAP
output - see app/services/shortfall_assessment_report.py. No new prediction,
no new SHAP calculation, no invented values.

One field beyond the literal spec: `label` on each factor/measure. Not
present in the originally given JSON shape, but added because the same
request explicitly asked to "show the feature name in human-readable form" -
this is additive (nothing specified was removed or renamed) and lets a
frontend or downstream consumer display the human name without needing to
re-implement the label lookup itself.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class ProductionSummary(BaseModel):
    target_production_tonnes: float
    predicted_production_tonnes: float
    shortfall_tonnes: float
    shortfall_percentage: float
    risk_level: str


class WhyFactor(BaseModel):
    feature: str
    label: str
    value: float
    shap_contribution: float
    direction: Literal["positive", "negative"]
    explanation: str


class WhyModelProducedResult(BaseModel):
    title: str = "Why did the model produce this result?"
    factors: list[WhyFactor]


class CorrectiveMeasureItem(BaseModel):
    feature: str
    label: str
    value: float
    shap_contribution: float
    measure: str


class RecommendedCorrectiveMeasures(BaseModel):
    title: str = "Recommended Corrective Measures"
    measures: list[CorrectiveMeasureItem]
    # Populated only when `measures` is empty - the honest "nothing
    # actionable was negative for this prediction" statement, never omitted
    # silently and never replaced with an invented measure.
    note: str | None = None


class ShortfallAssessmentReport(BaseModel):
    report_type: str = "Manganese Production Shortfall Assessment"
    production_summary: ProductionSummary
    why_model_produced_result: WhyModelProducedResult
    recommended_corrective_measures: RecommendedCorrectiveMeasures

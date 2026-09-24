"""Shaped for the redesigned Model 1 technical-assessment report (2026).
Built entirely from real ProspectivityResponse values - see
app/services/prospectivity_report.py for how, and what is/isn't invented.
Additive: ProspectivityResponse.report is a new optional field; every
pre-existing field (positive_contributors, negative_contributors,
recommended_exploration_measures, etc.) is untouched."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ProspectivityReportFactor(BaseModel):
    """One SHAP contributor as shown in the report - a curated subset of
    ProspectivityResponse.positive_contributors/negative_contributors (the
    full raw lists remain available on the response unchanged)."""

    model_config = ConfigDict(populate_by_name=True)

    feature: str
    label: str
    input_value: float | int | str | bool | None = Field(alias="inputValue")
    shap_value: float = Field(alias="shapValue")
    direction: Literal["supporting", "limiting"]
    explanation: str


class ProspectivityAssessmentSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    location: str
    prospectivity: str
    predicted_class: str = Field(alias="predictedClass")
    supporting_factors: str = Field(alias="supportingFactors")
    limiting_factors: str = Field(alias="limitingFactors")
    overall_action: str = Field(alias="overallAction")


class ProspectivityReportData(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # 1. Report header
    generated_at: str = Field(alias="generatedAt")
    target_mineral: str = Field(alias="targetMineral")

    # 2. Prospectivity assessment
    prospectivity_percentage: float = Field(alias="prospectivityPercentage")
    predicted_class_label: str = Field(alias="predictedClassLabel")
    narrative: str

    # 3. Why the model predicted it
    why_explanation: str = Field(alias="whyExplanation")

    # 4/5. Key factors influencing the prediction
    supporting_factors: list[ProspectivityReportFactor] = Field(alias="supportingFactors")
    limiting_factors: list[ProspectivityReportFactor] = Field(alias="limitingFactors")

    # 6/7. Consolidated recommended exploration plan
    exploration_plan_intro: str = Field(alias="explorationPlanIntro")
    exploration_plan: list[str] = Field(alias="explorationPlan")

    # 8. Assessment summary
    assessment_summary: ProspectivityAssessmentSummary = Field(alias="assessmentSummary")

"""Shaped to match frontend/src/types/index.ts's ShortfallReportData exactly
(camelCase JSON via aliases). Populated only from real request/response
values - see app/services/shortfall_report.py for how, and which fields
have no real backend source."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ShortfallReportCoordinates(BaseModel):
    lat: float
    lng: float


class ShortfallReportEnvironmental(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    weather_temp: str = Field(alias="weatherTemp")
    storm_risk: str = Field(alias="stormRisk")
    lightning_risk: str = Field(alias="lightningRisk")


class ShortfallReportSubmittedParameters(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    target_site: str = Field(alias="targetSite")
    target_extraction: str = Field(alias="targetExtraction")
    shift_crews_active: str = Field(alias="shiftCrewsActive")
    haulage_fleet: str = Field(alias="haulageFleet")
    geological_profile: str = Field(alias="geologicalProfile")


class ShortfallReportContributingFactor(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    description: str
    impact_percent: int = Field(alias="impactPercent")


class ShortfallReportData(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    site_name: str = Field(alias="siteName")
    coordinates: ShortfallReportCoordinates
    computed_ago: str = Field(alias="computedAgo")
    timestamp: str
    expected_shortfall_percent: float = Field(alias="expectedShortfallPercent")
    risk_level: Literal["LOW", "MODERATE RISK", "HIGH RISK"] = Field(alias="riskLevel")
    target_production_tonnes: float = Field(alias="targetProductionTonnes")
    predicted_output_tonnes: float = Field(alias="predictedOutputTonnes")
    expected_gap_tonnes: float = Field(alias="expectedGapTonnes")
    environmental: ShortfallReportEnvironmental
    submitted_parameters: ShortfallReportSubmittedParameters = Field(alias="submittedParameters")
    contributing_factors: list[ShortfallReportContributingFactor] = Field(alias="contributingFactors")
    corrective_measures: list[str] = Field(alias="correctiveMeasures")

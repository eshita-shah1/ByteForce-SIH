from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class RunLogResponse(BaseModel):
    """Shaped to match frontend/src/types/index.ts's RunLog exactly (camelCase
    JSON via aliases, so the Python side can stay snake_case)."""

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())

    id: str
    model_type: Literal["Prospectivity", "Shortfall"] = Field(alias="modelType")
    title: str
    target_site: str = Field(alias="targetSite")
    timestamp: str
    status: Literal["Completed", "Pending", "Flagged"]
    metric_highlight: str = Field(alias="metricHighlight")

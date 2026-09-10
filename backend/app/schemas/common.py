from __future__ import annotations

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    success: bool = False
    error_code: str
    message: str
    details: str | None = None


class LatLon(BaseModel):
    latitude: float
    longitude: float

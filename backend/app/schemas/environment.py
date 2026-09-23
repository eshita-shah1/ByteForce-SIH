"""GET /api/environment/{pit_id} - live environmental readings for the
Shortfall screen's "Live Environmental Context" bar. Independent of
ShortfallRequest/ShortfallResponse (app/schemas/shortfall.py) - this
endpoint exists purely to drive that display bar, never Model 2's
prediction, which continues to resolve its own environmental inputs via
POST /api/shortfall exactly as before.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class EnvironmentResponse(BaseModel):
    success: bool = True
    pit_id: str
    latitude: float
    longitude: float
    rainfall_intensity_mm: float
    cumulative_rainfall_72h: float
    soil_moisture_index: float
    temperature_celsius: float
    humidity_pct: float
    surface_water_risk: str
    observed_at: str = Field(
        ...,
        description=(
            "ISO-8601 timestamp WITH an explicit UTC offset (e.g. "
            "'2026-09-11T23:00:00+05:30'), the pit-local time of the "
            "underlying Open-Meteo hourly value - see weather_service.py."
        ),
    )
    source: str = "Open-Meteo"

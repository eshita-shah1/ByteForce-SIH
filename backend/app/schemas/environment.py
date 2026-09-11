"""GET /api/environment/{pit_id} - live environmental readings for the
Shortfall screen's "Live Environmental Context" bar. Independent of
ShortfallRequest/ShortfallResponse (app/schemas/shortfall.py) - this
endpoint exists purely to drive that display bar, never Model 2's
prediction, which continues to resolve its own environmental inputs via
POST /api/shortfall exactly as before.
"""
from __future__ import annotations

from pydantic import BaseModel


class EnvironmentResponse(BaseModel):
    success: bool = True
    pit_id: str
    latitude: float
    longitude: float
    rainfall_intensity_mm: float
    cumulative_rainfall_72h: float
    soil_moisture_index: float
    temperature_celsius: float
    surface_water_risk: str
    observed_at: str
    source: str = "Open-Meteo"

"""GET /api/environment/{pit_id} - live environmental readings for the
Shortfall screen's "Live Environmental Context" bar (ShortfallView.tsx).

Reuses the exact same weather_service.fetch_live_environment() that
POST /api/shortfall's prediction flow already calls (via
external_data_service.py) - no second Open-Meteo client. This endpoint is
purely a UI-context read; it never touches Model 2, the shortfall/risk
calculation, or corrective-measure logic.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.core.exceptions import NoMatchingRecordError
from app.ml.model2.feature_schema import PIT_COORDINATES
from app.schemas.environment import EnvironmentResponse
from app.services.weather_service import classify_surface_water_risk, fetch_live_environment

router = APIRouter(tags=["environment"])


@router.get("/api/environment/{pit_id}", response_model=EnvironmentResponse)
async def get_environment(pit_id: str, settings: Settings = Depends(get_settings)):
    if pit_id not in PIT_COORDINATES:
        raise NoMatchingRecordError(
            f"Unknown pit_id: {pit_id}",
            details=f"Must be one of {sorted(PIT_COORDINATES.keys())}",
        )

    lat, lon = PIT_COORDINATES[pit_id]
    live = await fetch_live_environment(lat, lon, settings)

    return EnvironmentResponse(
        pit_id=pit_id,
        latitude=lat,
        longitude=lon,
        rainfall_intensity_mm=live["rainfall_intensity_mm"],
        cumulative_rainfall_72h=live["cumulative_rainfall_72h"],
        soil_moisture_index=live["soil_moisture_index"],
        temperature_celsius=live["temperature_celsius"],
        humidity_pct=live["humidity_pct"],
        surface_water_risk=classify_surface_water_risk(
            live["rainfall_intensity_mm"], live["cumulative_rainfall_72h"]
        ),
        observed_at=live["observed_at"],
    )

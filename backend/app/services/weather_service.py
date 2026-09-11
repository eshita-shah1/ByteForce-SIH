"""Live weather/soil data client (Open-Meteo - free, no API key required).

Only fetches the specific variables Module 2 actually needs
(app.ml.model2.feature_schema.LIVE_SOURCEABLE_FEATURES): rainfall,
cumulative 72h rainfall, and soil moisture. (v1 also fetched near-surface
temperature as a land_surface_temperature_c proxy; the v2 model doesn't use
that feature, so it's no longer fetched.)
"""
from __future__ import annotations

import logging

import httpx

from app.core.config import Settings
from app.core.exceptions import ExternalApiError

logger = logging.getLogger("app.weather")


async def fetch_live_environment(lat: float, lon: float, settings: Settings) -> dict:
    """Returns rainfall_intensity_mm, cumulative_rainfall_72h,
    soil_moisture_index for the given point."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "precipitation,soil_moisture_0_to_7cm",
        "past_days": 3,
        "forecast_days": 1,
        "timezone": "auto",
    }
    try:
        async with httpx.AsyncClient(timeout=settings.external_api_timeout_seconds) as client:
            resp = await client.get(settings.open_meteo_base_url, params=params)
            resp.raise_for_status()
            payload = resp.json()
    except httpx.TimeoutException as exc:
        raise ExternalApiError(
            "Live weather data could not be retrieved (timeout).",
            details=str(exc),
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise ExternalApiError(
            "Live weather data could not be retrieved (upstream error).",
            details=f"status={exc.response.status_code}",
        ) from exc
    except httpx.HTTPError as exc:
        raise ExternalApiError(
            "Live weather data could not be retrieved (network error).",
            details=str(exc),
        ) from exc

    try:
        hourly = payload["hourly"]
        precipitation = hourly["precipitation"]
        soil_moisture = hourly["soil_moisture_0_to_7cm"]
        if not precipitation or not soil_moisture:
            raise KeyError("empty hourly series")

        # "current" rainfall intensity = most recent hourly value; 72h
        # cumulative = sum of the last 72 hourly values available.
        rainfall_intensity_mm = float(precipitation[-1])
        cumulative_rainfall_72h = float(sum(v for v in precipitation[-72:] if v is not None))
        soil_moisture_index = float(soil_moisture[-1])
    except (KeyError, IndexError, TypeError) as exc:
        raise ExternalApiError(
            "Live weather data response was malformed.",
            details=str(exc),
        ) from exc

    return {
        "rainfall_intensity_mm": rainfall_intensity_mm,
        "cumulative_rainfall_72h": cumulative_rainfall_72h,
        "soil_moisture_index": soil_moisture_index,
    }

"""Live weather/soil data client (Open-Meteo - free, no API key required).

Fetches rainfall, cumulative 72h rainfall, and soil moisture - the three
variables Module 2 actually needs
(app.ml.model2.feature_schema.LIVE_SOURCEABLE_FEATURES) - plus air
temperature, which Module 2 does NOT use (v1 fetched near-surface
temperature as a land_surface_temperature_c proxy; the v2 model has no
such feature) but the Shortfall screen's "Live Environmental Context" bar
(app/api/environment.py) displays for the user. Temperature is returned
in this function's dict under a key outside LIVE_SOURCEABLE_FEATURES, so
external_data_service.resolve_environment_features() - which only reads
the 3 keys it knows about - silently ignores it; Model 2's feature vector
is unaffected.
"""
from __future__ import annotations

import datetime as dt
import logging

import httpx

from app.core.config import Settings
from app.core.exceptions import ExternalApiError

logger = logging.getLogger("app.weather")


def _attach_utc_offset(naive_local_time: str, utc_offset_seconds: float | int | None) -> str:
    """With timezone=auto, Open-Meteo resolves the IANA zone for the
    requested lat/lon (e.g. "Asia/Kolkata") and returns every hourly.time
    entry as a timezone-NAIVE local wall-clock string (no "Z", no UTC
    offset) - e.g. "2026-09-11T23:00". A bare string like that is
    genuinely ambiguous: parsed with a UTC offset attached, it's
    unambiguous everywhere; parsed with none, a JS `new Date(...)` (or
    Python datetime.fromisoformat) silently assumes the CALLER's own
    local timezone, which is only coincidentally correct when the caller
    happens to share the pit's offset. Attaching the offset Open-Meteo
    itself already reports in the same response (`utc_offset_seconds` -
    the resolved offset for that specific timestamp/zone, correct across
    DST if the zone observes it) makes the value unambiguous for every
    downstream consumer, without this codebase hardcoding any specific
    timezone name."""
    if not isinstance(utc_offset_seconds, (int, float)):
        # Open-Meteo has always returned utc_offset_seconds with
        # timezone=auto in practice; this is a defensive fallback, not
        # the expected path - still better than crashing the request.
        logger.warning("Open-Meteo response missing utc_offset_seconds; observed_at will be timezone-naive.")
        return naive_local_time
    tz = dt.timezone(dt.timedelta(seconds=utc_offset_seconds))
    return dt.datetime.fromisoformat(naive_local_time).replace(tzinfo=tz).isoformat()


async def fetch_live_environment(lat: float, lon: float, settings: Settings) -> dict:
    """Returns rainfall_intensity_mm, cumulative_rainfall_72h,
    soil_moisture_index, temperature_celsius, and observed_at (an
    ISO-8601 timestamp WITH an explicit UTC offset, e.g.
    "2026-09-11T23:00:00+05:30" - the pit-local time of the latest hourly
    value used, unambiguous regardless of the caller's own timezone) for
    the given point."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "precipitation,soil_moisture_0_to_7cm,temperature_2m",
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
        temperature = hourly["temperature_2m"]
        times = hourly["time"]
        if not precipitation or not soil_moisture or not temperature or not times:
            raise KeyError("empty hourly series")

        # "current" rainfall intensity = most recent hourly value; 72h
        # cumulative = sum of the last 72 hourly values available.
        rainfall_intensity_mm = float(precipitation[-1])
        cumulative_rainfall_72h = float(sum(v for v in precipitation[-72:] if v is not None))
        soil_moisture_index = float(soil_moisture[-1])
        temperature_celsius = float(temperature[-1])

        observed_at = _attach_utc_offset(str(times[-1]), payload.get("utc_offset_seconds"))
    except (KeyError, IndexError, TypeError) as exc:
        raise ExternalApiError(
            "Live weather data response was malformed.",
            details=str(exc),
        ) from exc

    return {
        "rainfall_intensity_mm": rainfall_intensity_mm,
        "cumulative_rainfall_72h": cumulative_rainfall_72h,
        "soil_moisture_index": soil_moisture_index,
        "temperature_celsius": temperature_celsius,
        "observed_at": observed_at,
    }


def classify_surface_water_risk(rainfall_intensity_mm: float, cumulative_rainfall_72h: float) -> str:
    """A simple, transparent display heuristic for the "Live Environmental
    Context" bar only - NOT the corrective-measure engine
    (app/services/recommendation_service.py), which is untouched and
    remains the sole source of truth for shortfall risk/corrective
    measures. The 25mm single-hour threshold matches
    recommendation_service.py's existing "heavy rainfall" cutoff; the
    other bands are display-only groupings, not scientific thresholds.
    Deliberately does not factor in soil_moisture_index - Open-Meteo's
    soil_moisture_0_to_7cm has no established real-world threshold
    anywhere else in this codebase, and inventing one here would not be
    a "transparent rule", it would be a guess."""
    if rainfall_intensity_mm >= 25 or cumulative_rainfall_72h >= 50:
        return "High surface water risk"
    if rainfall_intensity_mm >= 10 or cumulative_rainfall_72h >= 20:
        return "Moderate surface water risk"
    return "Low surface water risk"

"""Orchestrates which Module 2 fields come from the user vs. a live API.

Policy: if the caller supplied a value for a live-sourceable field, that
value wins (source="user") and no API call is made for it. If the caller
left it out (None), a live fetch is attempted (source="weather_api"). If
that fetch fails, prediction stops with a clear EXTERNAL_API_UNAVAILABLE
error rather than fabricating a value - unless the caller also left a
"user override not supplied and API unavailable" state, which is exactly
the failure this raises for.
"""
from __future__ import annotations

from app.core.config import Settings
from app.ml.model2.feature_schema import LIVE_SOURCEABLE_FEATURES, PIT_COORDINATES
from app.services.weather_service import fetch_live_environment


async def resolve_environment_features(request_dict: dict, settings: Settings) -> tuple[dict, dict]:
    """Returns (resolved_values, feature_sources) for the live-sourceable
    fields only. resolved_values contains just the fields that were
    resolved (user-provided or live-fetched); feature_sources maps each to
    "user" or "weather_api"."""
    resolved: dict = {}
    sources: dict = {}

    needs_live_fetch = False
    for field in LIVE_SOURCEABLE_FEATURES:
        value = request_dict.get(field)
        if value is not None:
            resolved[field] = value
            sources[field] = "user"
        else:
            needs_live_fetch = True

    if needs_live_fetch:
        lat, lon = PIT_COORDINATES[request_dict["pit_id"]]
        live = await fetch_live_environment(lat, lon, settings)
        for field in LIVE_SOURCEABLE_FEATURES:
            if field not in resolved:
                resolved[field] = live[field]
                sources[field] = "weather_api"

    return resolved, sources

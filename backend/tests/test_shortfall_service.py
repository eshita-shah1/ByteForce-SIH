"""End-to-end test of the real v2 Model 2 artifact through
predict_shortfall(): prediction -> shortfall -> risk -> corrective measures.
Requires a full environment (real model artifacts in models/); supplies all
live-sourceable fields directly so no network call to the weather API is
needed."""
import pytest

from app.core.config import get_settings
from app.schemas.shortfall import ShortfallRequest


def _valid_payload(**overrides):
    payload = {
        "timestamp": "2026-09-08T10:00:00",
        "shift_type": "Shift_1_Morning",
        "pit_id": "BAL_NORTH_PIT",
        "target_production_tonnes": 5000,
        "planned_operating_hours": 8,
        "surface_water_pooling_pct": 5,
        "excavators_available": 5,
        "dump_trucks_operational": 10,
        "workers_scheduled": 50,
        "workers_available": 48,
        "previous_shift_production_tonnes": 4800,
        "previous_day_production_tonnes": 9600,
        # Supplied directly so resolve_environment_features() never needs to
        # reach the live weather API in a test.
        "rainfall_intensity_mm": 5.0,
        "cumulative_rainfall_72h": 12.0,
        "soil_moisture_index": 20.0,
    }
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
async def test_predict_shortfall_end_to_end_with_real_model():
    from app.services.model2_service import model2_service
    from app.services.shortfall_service import predict_shortfall

    settings = get_settings()
    if not settings.model2_pipeline_path.exists():
        pytest.skip("Model 2 artifact not present in models/")
    if not model2_service.is_loaded:
        model2_service.load(settings)
    if not model2_service.is_loaded:
        pytest.skip("Model 2 failed to load in this environment.")

    request = ShortfallRequest(**_valid_payload())
    response = await predict_shortfall(request, settings)

    assert response.success is True
    assert isinstance(response.predicted_production_tonnes, float)

    # Shortfall arithmetic must match the documented v2 formula exactly.
    expected_shortfall = max(0.0, request.target_production_tonnes - response.predicted_production_tonnes)
    assert response.shortfall_tonnes == round(expected_shortfall, 2)
    expected_pct = (expected_shortfall / request.target_production_tonnes * 100) if request.target_production_tonnes > 0 else 0.0
    assert response.shortfall_percentage == round(expected_pct, 2)

    # v2 risk thresholds: <10 Normal, 10-<25 Alert, >=25 Critical.
    if response.shortfall_percentage < 10:
        assert response.risk == "Normal"
    elif response.shortfall_percentage < 25:
        assert response.risk == "Alert"
    else:
        assert response.risk == "Critical"

    # Corrective measures are always present (at least the default fallback).
    assert len(response.corrective_measures) >= 1
    assert len(response.primary_causes) >= 1

    # feature_sources must reflect the trimmed v2 feature set only - no
    # leftover v1-only keys.
    assert "land_surface_temperature_c" not in response.feature_sources
    assert "excavator_downtime_hours" not in response.feature_sources
    assert response.feature_sources["rainfall_intensity_mm"] == "user"


@pytest.mark.asyncio
async def test_predict_shortfall_flags_high_shortfall_as_critical():
    """A tiny target relative to typical output should not itself change
    behavior; this drives a large predicted-vs-target gap by setting an
    unreasonably high target, which the real model cannot come close to,
    to exercise the Critical branch end-to-end."""
    from app.services.model2_service import model2_service
    from app.services.shortfall_service import predict_shortfall

    settings = get_settings()
    if not settings.model2_pipeline_path.exists():
        pytest.skip("Model 2 artifact not present in models/")
    if not model2_service.is_loaded:
        model2_service.load(settings)
    if not model2_service.is_loaded:
        pytest.skip("Model 2 failed to load in this environment.")

    request = ShortfallRequest(**_valid_payload(target_production_tonnes=1_000_000))
    response = await predict_shortfall(request, settings)

    assert response.shortfall_percentage >= 25
    assert response.risk == "Critical"

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
        "target_production_tonnes": 300,
        "planned_operating_hours": 8,
        "surface_water_pooling_pct": 5,
        "excavators_available": 5,
        "dump_trucks_operational": 10,
        "workers_scheduled": 50,
        "workers_available": 48,
        "previous_shift_production_tonnes": 85,
        "previous_day_production_tonnes": 170,
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
    """Drives a large predicted-vs-target gap by setting the maximum allowed
    target (600 tonnes/shift - the schema caps target_production_tonnes at
    600, see app/schemas/shortfall.py) against otherwise-modest inputs.
    Empirically (see the 2026-09-11 negative-prediction audit), the real
    model's output for inputs anywhere in the current 150-600 range is
    negative, so this reliably exercises the Critical branch end-to-end."""
    from app.services.model2_service import model2_service
    from app.services.shortfall_service import predict_shortfall

    settings = get_settings()
    if not settings.model2_pipeline_path.exists():
        pytest.skip("Model 2 artifact not present in models/")
    if not model2_service.is_loaded:
        model2_service.load(settings)
    if not model2_service.is_loaded:
        pytest.skip("Model 2 failed to load in this environment.")

    request = ShortfallRequest(**_valid_payload(target_production_tonnes=600))
    response = await predict_shortfall(request, settings)

    assert response.shortfall_percentage >= 25
    assert response.risk == "Critical"


@pytest.mark.asyncio
async def test_predicted_production_is_never_negative_even_when_raw_model_output_is():
    """Regression test for the physical-floor fix in predict_shortfall():
    Model 2's raw XGBRegressor output can genuinely go negative for
    realistic inputs (verified directly against the artifact - no target
    transform, no built-in non-negativity constraint). A negative tonnage
    is not a meaningful real-world quantity, so predicted_production_tonnes
    must be floored at 0 - and, as a direct mathematical consequence (not
    a separate cap), shortfall_percentage must never exceed 100%."""
    from app.services.model2_service import model2_service
    from app.services.shortfall_service import predict_shortfall

    settings = get_settings()
    if not settings.model2_pipeline_path.exists():
        pytest.skip("Model 2 artifact not present in models/")
    if not model2_service.is_loaded:
        model2_service.load(settings)
    if not model2_service.is_loaded:
        pytest.skip("Model 2 failed to load in this environment.")

    # Inputs empirically confirmed (2026-09 audit) to drive the real raw
    # model prediction negative for this artifact.
    request = ShortfallRequest(
        **_valid_payload(
            target_production_tonnes=150,
            workers_available=48,
            workers_scheduled=50,
            excavators_available=8,
            dump_trucks_operational=15,
            surface_water_pooling_pct=2,
            previous_shift_production_tonnes=140,
            previous_day_production_tonnes=420,
            rainfall_intensity_mm=0.0,
            cumulative_rainfall_72h=0.0,
            soil_moisture_index=10.0,
        )
    )
    response = await predict_shortfall(request, settings)

    assert response.predicted_production_tonnes >= 0
    assert 0 <= response.shortfall_percentage <= 100
    assert response.shortfall_tonnes >= 0
    assert response.shortfall_tonnes <= response.target_production_tonnes
    # This specific combination's raw prediction is negative (confirmed via
    # direct pipeline inspection), so the floor should actually engage here,
    # not just happen to already be non-negative.
    assert response.predicted_production_tonnes == 0.0
    assert response.shortfall_percentage == 100.0


@pytest.mark.asyncio
async def test_shortfall_percentage_never_exceeds_100_across_target_range():
    """Sweeps target_production_tonnes across its full 150-600 schema
    range with fixed, otherwise-identical inputs and checks every
    response obeys 0 <= predicted, 0 <= shortfall% <= 100 - guards
    against the exact bug reported (111%/132%/290% shortfalls from
    negative predicted_production_tonnes)."""
    from app.services.model2_service import model2_service
    from app.services.shortfall_service import predict_shortfall

    settings = get_settings()
    if not settings.model2_pipeline_path.exists():
        pytest.skip("Model 2 artifact not present in models/")
    if not model2_service.is_loaded:
        model2_service.load(settings)
    if not model2_service.is_loaded:
        pytest.skip("Model 2 failed to load in this environment.")

    for target in (150, 200, 300, 500, 600):
        request = ShortfallRequest(**_valid_payload(target_production_tonnes=target))
        response = await predict_shortfall(request, settings)
        assert response.predicted_production_tonnes >= 0, f"negative prediction at target={target}"
        assert 0 <= response.shortfall_percentage <= 100, f"shortfall%% out of bounds at target={target}"

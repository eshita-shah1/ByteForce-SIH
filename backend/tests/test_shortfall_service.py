"""End-to-end test of the real v3 Model 2 artifact through
predict_shortfall(): prediction -> shortfall -> risk -> corrective measures
-> SHAP explanation."""
import pytest

from app.core.config import get_settings
from app.schemas.shortfall import ShortfallRequest


def _valid_payload(**overrides):
    payload = {
        "timestamp": "2026-09-08T10:00:00",
        "shift_type": "Shift_1_Morning",
        "pit_id": "BAL_NORTH_PIT",
        "target_production_tonnes": 550,
        "planned_operating_hours": 8,
        "surface_water_pooling_pct": 5,
        "excavators_available": 6,
        "dump_trucks_operational": 12,
        "workers_scheduled": 50,
        "workers_available": 45,
        "previous_shift_production_tonnes": 450,
        "previous_day_production_tonnes": 900,
        "equipment_downtime_hours": 1.5,
        "dumper_cycle_time_minutes": 18.0,
        # Supplied directly so resolve_environment_features() never needs to
        # reach the live weather API in a test.
        "rainfall_intensity_mm": 5.0,
        "cumulative_rainfall_72h": 10.0,
        "soil_moisture_index": 0.3,
        "humidity_pct": 60.0,
        "land_surface_temperature_c": 28.0,
    }
    payload.update(overrides)
    return payload


def _low_resource_payload(**overrides):
    """Deliberately resource-starved, weather-adverse inputs, empirically
    confirmed (2026-09-22 audit) to drive the real v3 model's raw
    prediction well negative (~-153.7 tonnes at target=400) - used to
    exercise the recentering/critical-risk paths for real, not via a
    contrived mock."""
    payload = _valid_payload(
        workers_available=10,
        workers_scheduled=50,
        excavators_available=1,
        dump_trucks_operational=2,
        equipment_downtime_hours=8.0,
        planned_operating_hours=4.0,
        dumper_cycle_time_minutes=45.0,
        cumulative_rainfall_72h=80.0,
        humidity_pct=95.0,
        land_surface_temperature_c=40.0,
        soil_moisture_index=0.9,
        surface_water_pooling_pct=90.0,
        previous_shift_production_tonnes=50.0,
        previous_day_production_tonnes=100.0,
        target_production_tonnes=400,
    )
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
async def test_predict_shortfall_end_to_end_with_real_model():
    from app.services.model2_service import model2_service
    from app.services.shortfall_service import predict_shortfall

    settings = get_settings()
    if not settings.model2_v3_model_path.exists():
        pytest.skip("Model 2 v3 artifact not present in models/")
    if not model2_service.is_loaded:
        model2_service.load(settings)
    if not model2_service.is_loaded:
        pytest.skip("Model 2 v3 failed to load in this environment.")

    request = ShortfallRequest(**_valid_payload())
    response = await predict_shortfall(request, settings)

    assert response.success is True
    assert isinstance(response.predicted_production_tonnes, float)

    # Shortfall arithmetic must match the documented formula exactly.
    expected_shortfall = max(0.0, request.target_production_tonnes - response.predicted_production_tonnes)
    assert response.shortfall_tonnes == round(expected_shortfall, 2)
    expected_pct = (expected_shortfall / request.target_production_tonnes * 100) if request.target_production_tonnes > 0 else 0.0
    assert response.shortfall_percentage == round(expected_pct, 2)

    # Risk thresholds (unchanged by the model swap): <10 Normal, 10-<25 Alert, >=25 Critical.
    if response.shortfall_percentage < 10:
        assert response.risk == "Normal"
    elif response.shortfall_percentage < 25:
        assert response.risk == "Alert"
    else:
        assert response.risk == "Critical"

    # Corrective measures are always present (at least the default fallback).
    assert len(response.corrective_measures) >= 1
    assert len(response.primary_causes) >= 1

    # feature_sources must reflect the v3 feature set, all directly supplied.
    assert response.feature_sources["rainfall_intensity_mm"] == "user"
    assert response.feature_sources["humidity_pct"] == "user"
    assert response.feature_sources["land_surface_temperature_c"] == "user"
    assert response.feature_sources["equipment_downtime_hours"] == "user"
    assert response.feature_sources["dumper_cycle_time_minutes"] == "user"

    # Real SHAP explanation, not fabricated.
    assert response.shap_explanation is not None
    assert 1 <= len(response.shap_explanation) <= 5
    for contribution in response.shap_explanation:
        assert contribution.feature in model2_service.feature_columns
        assert contribution.direction in ("increases_prediction", "decreases_prediction")


@pytest.mark.asyncio
async def test_predict_shortfall_flags_high_shortfall_as_critical():
    from app.services.model2_service import model2_service
    from app.services.shortfall_service import predict_shortfall

    settings = get_settings()
    if not settings.model2_v3_model_path.exists():
        pytest.skip("Model 2 v3 artifact not present in models/")
    if not model2_service.is_loaded:
        model2_service.load(settings)
    if not model2_service.is_loaded:
        pytest.skip("Model 2 v3 failed to load in this environment.")

    request = ShortfallRequest(**_low_resource_payload(target_production_tonnes=600))
    response = await predict_shortfall(request, settings)

    assert response.shortfall_percentage >= 25
    assert response.risk == "Critical"


@pytest.mark.asyncio
async def test_predicted_production_applies_the_recentering_correction():
    """Regression test for the target-recentering fix in predict_shortfall()
    (see MODEL2_TARGET_RECENTERING_TONNES in shortfall_service.py): Model 2
    v3's raw XGBRegressor output is centered near 0 rather than on the real
    actual_production_tonnes scale (~499 tonnes), the same "target-mean-
    centering transform with no inverse in the artifact" signature as the
    retired v2 model, just a different constant. predicted_production_tonnes
    must equal the raw model output plus that recentering constant (floored
    at 0), not the raw output directly."""
    from app.services.model2_service import model2_service
    from app.services.shortfall_service import MODEL2_TARGET_RECENTERING_TONNES, predict_shortfall

    settings = get_settings()
    if not settings.model2_v3_model_path.exists():
        pytest.skip("Model 2 v3 artifact not present in models/")
    if not model2_service.is_loaded:
        model2_service.load(settings)
    if not model2_service.is_loaded:
        pytest.skip("Model 2 v3 failed to load in this environment.")

    payload = _low_resource_payload(target_production_tonnes=400)
    request = ShortfallRequest(**payload)

    request_dict = request.model_dump()
    raw_prediction = model2_service.predict(request_dict)
    expected_prediction = max(0.0, raw_prediction + MODEL2_TARGET_RECENTERING_TONNES)

    response = await predict_shortfall(request, settings)

    assert response.predicted_production_tonnes >= 0
    assert 0 <= response.shortfall_percentage <= 100
    assert response.shortfall_tonnes >= 0
    assert response.shortfall_tonnes <= response.target_production_tonnes
    # This exact payload's raw prediction is genuinely negative (confirmed
    # via direct inspection), so this exercises the recentering arithmetic
    # for real, not a case that would already be positive anyway.
    assert raw_prediction < 0
    assert response.predicted_production_tonnes == round(expected_prediction, 2)


@pytest.mark.asyncio
async def test_predicted_production_floor_still_engages_if_recentering_is_insufficient(monkeypatch):
    """The recentering correction is not a proof that raw + constant can
    never be negative - it is an empirical property of this artifact's
    observed output range (see backend/data/model2_training_dataset_v2.csv:
    0 negative corrected predictions across all 5,000 rows), not a
    mathematical guarantee. The physical floor at 0 must remain as a
    defensive safeguard. This test forces the condition directly since no
    real input is currently known to trigger it."""
    from app.services.model2_service import model2_service
    from app.services.shortfall_service import MODEL2_TARGET_RECENTERING_TONNES, predict_shortfall

    settings = get_settings()
    if not settings.model2_v3_model_path.exists():
        pytest.skip("Model 2 v3 artifact not present in models/")
    if not model2_service.is_loaded:
        model2_service.load(settings)
    if not model2_service.is_loaded:
        pytest.skip("Model 2 v3 failed to load in this environment.")

    monkeypatch.setattr(
        model2_service, "predict", lambda _request_dict: -(MODEL2_TARGET_RECENTERING_TONNES + 50.0)
    )

    request = ShortfallRequest(**_valid_payload(target_production_tonnes=400))
    response = await predict_shortfall(request, settings)

    assert response.predicted_production_tonnes == 0.0
    assert response.shortfall_percentage == 100.0
    assert response.shortfall_tonnes == response.target_production_tonnes


@pytest.mark.asyncio
async def test_shortfall_percentage_never_exceeds_100_across_target_range():
    """Sweeps target_production_tonnes across its full 400-600 v3 schema
    range with fixed, otherwise-identical inputs and checks every response
    obeys 0 <= predicted, 0 <= shortfall% <= 100."""
    from app.services.model2_service import model2_service
    from app.services.shortfall_service import predict_shortfall

    settings = get_settings()
    if not settings.model2_v3_model_path.exists():
        pytest.skip("Model 2 v3 artifact not present in models/")
    if not model2_service.is_loaded:
        model2_service.load(settings)
    if not model2_service.is_loaded:
        pytest.skip("Model 2 v3 failed to load in this environment.")

    for target in (400, 450, 500, 550, 600):
        request = ShortfallRequest(**_valid_payload(target_production_tonnes=target))
        response = await predict_shortfall(request, settings)
        assert response.predicted_production_tonnes >= 0, f"negative prediction at target={target}"
        assert 0 <= response.shortfall_percentage <= 100, f"shortfall%% out of bounds at target={target}"


def test_recentering_constant_is_reproducible_from_the_checked_in_training_dataset():
    """MODEL2_TARGET_RECENTERING_TONNES (shortfall_service.py) is not a
    magic number frozen with no way to re-derive or falsify it: this test
    recomputes it directly from
    backend/data/model2_training_dataset_v2.csv (5,000 rows shipped
    alongside model2_xgboost_production.pkl, columns matching its 15
    required features exactly, with genuine actual_production_tonnes
    outcomes), fitting on an 80% split and checking accuracy on the
    untouched 20% holdout - the same methodology used for the retired v2
    constant (421.19), just against v3's own dataset/artifact."""
    import numpy as np
    import pandas as pd

    from app.core.config import DATA_DIR, get_settings
    from app.services.model2_service import model2_service
    from app.services.shortfall_service import MODEL2_TARGET_RECENTERING_TONNES

    settings = get_settings()
    if not settings.model2_v3_model_path.exists():
        pytest.skip("Model 2 v3 artifact not present in models/")
    if not model2_service.is_loaded:
        model2_service.load(settings)
    if not model2_service.is_loaded:
        pytest.skip("Model 2 v3 failed to load in this environment.")

    csv_path = DATA_DIR / "model2_training_dataset_v2.csv"
    if not csv_path.exists():
        pytest.skip("v3 training dataset not present in backend/data/.")

    df = pd.read_csv(csv_path)
    rng = np.random.RandomState(42)
    idx = rng.permutation(len(df))
    split = int(len(df) * 0.8)
    train_idx, holdout_idx = idx[:split], idx[split:]

    raw_predictions = df.apply(
        lambda row: model2_service.predict({c: row[c] for c in model2_service.feature_columns}), axis=1
    )
    actual = df["actual_production_tonnes"]

    recomputed_constant = (actual.iloc[train_idx] - raw_predictions.iloc[train_idx]).mean()

    # The constant baked into shortfall_service.py must match what this
    # dataset actually recomputes today (within rounding of the value
    # frozen at implementation time), not silently drift out of sync with
    # the artifact or dataset it was derived from.
    assert recomputed_constant == pytest.approx(MODEL2_TARGET_RECENTERING_TONNES, abs=1.0)

    corrected_holdout = raw_predictions.iloc[holdout_idx] + MODEL2_TARGET_RECENTERING_TONNES
    actual_holdout = actual.iloc[holdout_idx]
    mae_corrected = (corrected_holdout - actual_holdout).abs().mean()
    mae_raw = (raw_predictions.iloc[holdout_idx] - actual_holdout).abs().mean()

    # The correction must be a large, real accuracy improvement on data it
    # was not fit on, and must not merely relocate the negative-prediction
    # problem elsewhere in the dataset.
    assert mae_corrected < mae_raw / 5
    assert (corrected_holdout < 0).sum() == 0

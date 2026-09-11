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
        "target_production_tonnes": 600,
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
    target (700 tonnes/shift - the schema caps target_production_tonnes at
    700, see app/schemas/shortfall.py) against otherwise-modest inputs.
    Empirically (see the 2026-09-12 target-scale characterization sweep),
    a large minority of realistic inputs even in the model's best-behaved
    500-700 window still produce a negative raw prediction; the recentering
    correction (MODEL2_TARGET_RECENTERING_TONNES) turns these into a real,
    positive, but still substantially-below-target prediction (~215 tonnes
    against a 700-tonne target for this exact payload), which is what
    reliably exercises the Critical branch here - not a floored-to-zero
    prediction."""
    from app.services.model2_service import model2_service
    from app.services.shortfall_service import predict_shortfall

    settings = get_settings()
    if not settings.model2_pipeline_path.exists():
        pytest.skip("Model 2 artifact not present in models/")
    if not model2_service.is_loaded:
        model2_service.load(settings)
    if not model2_service.is_loaded:
        pytest.skip("Model 2 failed to load in this environment.")

    request = ShortfallRequest(**_valid_payload(target_production_tonnes=700))
    response = await predict_shortfall(request, settings)

    assert response.shortfall_percentage >= 25
    assert response.risk == "Critical"


@pytest.mark.asyncio
async def test_predicted_production_applies_the_recentering_correction():
    """Regression test for the target-recentering fix in predict_shortfall()
    (see MODEL2_TARGET_RECENTERING_TONNES in shortfall_service.py): Model 2's
    raw XGBRegressor output is centered near 0 rather than on the real
    actual_production_tonnes scale (~421 tonnes), the signature of a
    target-mean-centering transform whose inverse was dropped from the
    exported pipeline. predicted_production_tonnes must equal the raw
    model output plus that recentering constant (floored at 0), not the
    raw output directly - this is what turns Model 2's real, unmodified
    predictions into a usable business quantity."""
    from app.services.model2_service import model2_service
    from app.services.shortfall_service import MODEL2_TARGET_RECENTERING_TONNES, predict_shortfall

    settings = get_settings()
    if not settings.model2_pipeline_path.exists():
        pytest.skip("Model 2 artifact not present in models/")
    if not model2_service.is_loaded:
        model2_service.load(settings)
    if not model2_service.is_loaded:
        pytest.skip("Model 2 failed to load in this environment.")

    # Inputs empirically confirmed (2026-09-12 audit) to drive the real raw
    # model prediction negative for this artifact (~-251 tonnes), using the
    # minimum allowed target (500) in the current 500-700 window - a case
    # that would floor to 0/100% shortfall under the old floor-only logic,
    # but recovers to a real positive prediction once recentered.
    payload = _valid_payload(target_production_tonnes=500)
    request = ShortfallRequest(**payload)

    request_dict = request.model_dump()
    request_dict["month"] = 9
    request_dict["day_of_week"] = 1
    request_dict.update(
        {
            "rainfall_intensity_mm": payload["rainfall_intensity_mm"],
            "cumulative_rainfall_72h": payload["cumulative_rainfall_72h"],
            "soil_moisture_index": payload["soil_moisture_index"],
        }
    )
    raw_prediction = model2_service.predict(request_dict)
    expected_prediction = max(0.0, raw_prediction + MODEL2_TARGET_RECENTERING_TONNES)

    response = await predict_shortfall(request, settings)

    assert response.predicted_production_tonnes >= 0
    assert 0 <= response.shortfall_percentage <= 100
    assert response.shortfall_tonnes >= 0
    assert response.shortfall_tonnes <= response.target_production_tonnes
    # The raw prediction for this input is genuinely negative (confirmed via
    # direct pipeline inspection), so this exercises the recentering
    # arithmetic for real, not a case that would already be positive anyway.
    assert raw_prediction < 0
    assert response.predicted_production_tonnes == round(expected_prediction, 2)


@pytest.mark.asyncio
async def test_predicted_production_floor_still_engages_if_recentering_is_insufficient(monkeypatch):
    """The recentering correction is not a proof that raw + constant can
    never be negative (see the 2026-09-12 sweep across every valid pit,
    shift, and an extreme-inputs combination: none produced a
    still-negative result, but that is an empirical property of this
    artifact's output range, not a mathematical guarantee). The physical
    floor at 0 must remain as a defensive safeguard. This test forces the
    condition directly (model2_service.predict monkeypatched to a value
    negative enough that adding the recentering constant still leaves it
    below 0) rather than relying on finding such an input in the real
    model, since none is currently known to exist."""
    from app.services.model2_service import model2_service
    from app.services.shortfall_service import MODEL2_TARGET_RECENTERING_TONNES, predict_shortfall

    settings = get_settings()
    if not settings.model2_pipeline_path.exists():
        pytest.skip("Model 2 artifact not present in models/")
    if not model2_service.is_loaded:
        model2_service.load(settings)
    if not model2_service.is_loaded:
        pytest.skip("Model 2 failed to load in this environment.")

    monkeypatch.setattr(
        model2_service, "predict", lambda _request_dict: -(MODEL2_TARGET_RECENTERING_TONNES + 50.0)
    )

    request = ShortfallRequest(**_valid_payload(target_production_tonnes=500))
    response = await predict_shortfall(request, settings)

    assert response.predicted_production_tonnes == 0.0
    assert response.shortfall_percentage == 100.0
    assert response.shortfall_tonnes == response.target_production_tonnes


@pytest.mark.asyncio
async def test_shortfall_percentage_never_exceeds_100_across_target_range():
    """Sweeps target_production_tonnes across its full 500-700 schema
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

    for target in (500, 550, 600, 650, 700):
        request = ShortfallRequest(**_valid_payload(target_production_tonnes=target))
        response = await predict_shortfall(request, settings)
        assert response.predicted_production_tonnes >= 0, f"negative prediction at target={target}"
        assert 0 <= response.shortfall_percentage <= 100, f"shortfall%% out of bounds at target={target}"


def test_recentering_constant_is_reproducible_from_the_checked_in_calibration_dataset():
    """MODEL2_TARGET_RECENTERING_TONNES (shortfall_service.py) is not a magic
    number frozen with no way to re-derive or falsify it: this test
    recomputes it directly from backend/data/model2_real_production_calibration.csv
    (5,000 real historical shifts with genuine actual_production_tonnes
    outcomes) on every test run and checks it against the value in
    production code, plus the accuracy improvement it buys."""
    import pandas as pd

    from app.core.config import DATA_DIR, get_settings
    from app.ml.model2.feature_schema import RAW_FEATURE_COLUMNS
    from app.services.model2_service import model2_service
    from app.services.shortfall_service import MODEL2_TARGET_RECENTERING_TONNES

    settings = get_settings()
    if not settings.model2_pipeline_path.exists():
        pytest.skip("Model 2 artifact not present in models/")
    if not model2_service.is_loaded:
        model2_service.load(settings)
    if not model2_service.is_loaded:
        pytest.skip("Model 2 failed to load in this environment.")

    csv_path = DATA_DIR / "model2_real_production_calibration.csv"
    if not csv_path.exists():
        pytest.skip("Calibration dataset not present in backend/data/.")

    df = pd.read_csv(csv_path)
    timestamps = pd.to_datetime(df["timestamp"])
    df["month"] = timestamps.dt.month
    df["day_of_week"] = timestamps.dt.dayofweek

    raw_predictions = df.apply(
        lambda row: model2_service.predict({c: row[c] for c in RAW_FEATURE_COLUMNS}), axis=1
    )
    actual = df["actual_production_tonnes"]

    diff = actual - raw_predictions
    recomputed_constant = diff.mean()

    # The constant baked into shortfall_service.py must match what this
    # dataset actually recomputes today (within rounding of the value
    # frozen at implementation time), not silently drift out of sync with
    # the artifact or dataset it was derived from.
    assert recomputed_constant == pytest.approx(MODEL2_TARGET_RECENTERING_TONNES, abs=0.5)

    corrected = raw_predictions + MODEL2_TARGET_RECENTERING_TONNES
    mae_corrected = (corrected - actual).abs().mean()
    mae_raw = (raw_predictions - actual).abs().mean()

    # The correction must be a large, real accuracy improvement (not a
    # negligible or spurious shift) and must not merely relocate the
    # negative-prediction problem elsewhere in the dataset.
    assert mae_corrected < mae_raw / 5
    assert (corrected < 0).sum() == 0

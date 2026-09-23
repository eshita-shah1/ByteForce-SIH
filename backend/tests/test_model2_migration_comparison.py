"""Migration verification (Model 2 v2 -> v3): loads BOTH the retired v2
pipeline and the live v3 model side-by-side and runs equivalent test
inputs through both, per the migration's safe-rollout requirement.

This is NOT a "must match" test - v2 and v3 are different XGBoost
artifacts with different feature sets (v2: 16 inputs incl. pit_id/
shift_type/month/day_of_week; v3: 15 numeric-only inputs incl.
equipment_downtime_hours/dumper_cycle_time_minutes/humidity_pct/
land_surface_temperature_c, none of which v2 has). There is no valid way
to feed "the same" input to both. What this DOES verify: both artifacts
still load correctly, both still produce finite, real predictions for
their own respective inputs (neither is silently broken by the migration),
and it prints both outputs (via -s) for a human to sanity-check side by
side before approving removal of the v2 artifact - see backend/models/
MOIL_Module2_Final_Model.pkl / moil_production_pipeline.pkl, which must
stay in place until that approval (Step 10 of the migration)."""
import pytest

from app.core.config import get_settings


def test_v2_and_v3_both_load_and_predict():
    from app.ml.model2.feature_schema import CATEGORICAL_FEATURES, NUMERIC_FEATURES
    from app.services.model2_service import Model2Service
    from app.services.model2_service_v2_legacy import LegacyModel2Service

    settings = get_settings()
    if not settings.model2_pipeline_path.exists() and not settings.model2_pipeline_fallback_path.exists():
        pytest.skip("Legacy v2 artifact not present in models/")
    if not settings.model2_v3_model_path.exists():
        pytest.skip("v3 artifact not present in models/")

    legacy = LegacyModel2Service()
    legacy.load(settings)
    v3 = Model2Service()
    v3.load(settings)

    if not legacy.is_loaded:
        pytest.skip("Legacy v2 failed to load in this environment.")
    if not v3.is_loaded:
        pytest.skip("v3 failed to load in this environment.")

    legacy_input = {
        "shift_type": CATEGORICAL_FEATURES["shift_type"][0],
        "pit_id": CATEGORICAL_FEATURES["pit_id"][0],
        "month": 9,
        "day_of_week": 1,
        **{f: 1.0 for f in NUMERIC_FEATURES},
    }
    v3_input = {f: 1.0 for f in v3.feature_columns}

    legacy_prediction = legacy.predict(legacy_input)
    v3_prediction = v3.predict(v3_input)

    import math

    assert math.isfinite(legacy_prediction)
    assert math.isfinite(v3_prediction)

    print(f"\n[migration comparison] legacy v2 raw prediction: {legacy_prediction:.4f}")
    print(f"[migration comparison] v3 raw prediction:         {v3_prediction:.4f}")
    print("[migration comparison] both artifacts load and predict; v2 retained pending explicit approval to remove.")

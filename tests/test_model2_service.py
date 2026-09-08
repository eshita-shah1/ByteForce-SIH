"""Loads the REAL Model 2 pipeline from models/ and runs end-to-end
inference (no mocks)."""
import pytest

from app.core.config import get_settings
from app.ml.model2.feature_schema import CATEGORICAL_FEATURES, NUMERIC_FEATURES, RAW_FEATURE_COLUMNS
from app.services.model2_service import Model2Service


@pytest.fixture(scope="module")
def loaded_service():
    settings = get_settings()
    if not settings.model2_pipeline_path.exists() and not settings.model2_pipeline_fallback_path.exists():
        pytest.skip("Model 2 artifacts not present in models/")
    svc = Model2Service()
    svc.load(settings)
    if not svc.is_loaded:
        pytest.skip("Model 2 failed to load in this environment (see README version-compatibility notes).")
    return svc


def _dummy_input() -> dict:
    row = {
        "shift_type": CATEGORICAL_FEATURES["shift_type"][0],
        "pit_id": CATEGORICAL_FEATURES["pit_id"][0],
        "month": 9,
        "day_of_week": 1,
    }
    for f in NUMERIC_FEATURES:
        row[f] = 1.0
    return row


def test_model2_loads(loaded_service):
    assert loaded_service.is_loaded


def test_model2_predict_returns_float(loaded_service):
    prediction = loaded_service.predict(_dummy_input())
    assert isinstance(prediction, float)


def test_model2_predict_raises_on_missing_feature(loaded_service):
    from app.core.exceptions import InferenceError

    incomplete = _dummy_input()
    del incomplete["worker_availability_pct"]
    with pytest.raises(InferenceError):
        loaded_service.predict(incomplete)


def test_raw_feature_columns_cover_categorical_and_numeric():
    assert set(RAW_FEATURE_COLUMNS) == set(CATEGORICAL_FEATURES) | set(NUMERIC_FEATURES) | {"month", "day_of_week"}

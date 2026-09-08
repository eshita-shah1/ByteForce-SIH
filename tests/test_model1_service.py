"""Loads the REAL Model 1 artifacts from models/ and runs end-to-end
inference. This is a smoke test, not a unit test with mocks - Model 1 must
never be tested against fabricated preprocessing logic."""
import pytest

from app.core.config import get_settings
from app.ml.model1.feature_schema import get_feature_columns, get_decision_threshold
from app.services.model1_service import Model1Service


@pytest.fixture(scope="module")
def loaded_service():
    settings = get_settings()
    if not settings.model1_model_path.exists():
        pytest.skip("Model 1 artifacts not present in models/")
    svc = Model1Service()
    svc.load(settings)
    if not svc.is_loaded:
        pytest.skip("Model 1 failed to load in this environment (see README version-compatibility notes).")
    return svc


def _dummy_feature_row() -> dict:
    row = {}
    for col in get_feature_columns():
        if col == "surface_zone":
            row[col] = "bare_rock_ore"
        elif col == "soil_wrb_class_code":
            row[col] = 16
        elif col == "terrain_available":
            row[col] = True
        elif col == "is_mine_core_zone":
            row[col] = 0
        else:
            row[col] = 0.1
    return row


def test_model1_loads_and_reports_threshold(loaded_service):
    assert loaded_service.is_loaded
    assert loaded_service._threshold == get_decision_threshold()


def test_model1_predict_returns_expected_shape(loaded_service):
    result = loaded_service.predict(_dummy_feature_row())
    assert result["prediction"] in ("manganese_present", "manganese_absent")
    assert 0.0 <= result["probability"] <= 1.0
    assert result["features_used"] == get_feature_columns()


def test_model1_predict_raises_on_missing_feature(loaded_service):
    from app.core.exceptions import InferenceError

    incomplete = _dummy_feature_row()
    del incomplete["terrain_elevation"]
    with pytest.raises(InferenceError):
        loaded_service.predict(incomplete)

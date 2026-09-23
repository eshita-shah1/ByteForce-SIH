"""Loads the REAL Model 2 v3 artifact (model2_xgboost_production.pkl +
model2_shap_explainer.pkl) from models/ and runs end-to-end inference and
explanation (no mocks)."""
import pytest

from app.core.config import get_settings
from app.services.model2_service import Model2Service


@pytest.fixture(scope="module")
def loaded_service():
    settings = get_settings()
    if not settings.model2_v3_model_path.exists():
        pytest.skip("Model 2 v3 artifact not present in models/")
    svc = Model2Service()
    svc.load(settings)
    if not svc.is_loaded:
        pytest.skip("Model 2 v3 failed to load in this environment.")
    return svc


def _dummy_input(service: Model2Service) -> dict:
    return {c: 1.0 for c in service.feature_columns}


def test_model2_loads(loaded_service):
    assert loaded_service.is_loaded


def test_model2_feature_columns_match_shipped_spec(loaded_service):
    import json

    settings = get_settings()
    with open(settings.model2_v3_features_path, encoding="utf-8") as f:
        spec_columns = json.load(f)
    assert loaded_service.feature_columns == spec_columns


def test_model2_predict_returns_float(loaded_service):
    prediction = loaded_service.predict(_dummy_input(loaded_service))
    assert isinstance(prediction, float)


def test_model2_predict_raises_on_missing_feature(loaded_service):
    from app.core.exceptions import InferenceError

    incomplete = _dummy_input(loaded_service)
    del incomplete[loaded_service.feature_columns[0]]
    with pytest.raises(InferenceError):
        loaded_service.predict(incomplete)


def test_model2_explainer_loads(loaded_service):
    assert loaded_service.explainer_loaded


def test_model2_explain_reconciles_with_predict(loaded_service):
    """sum(shap_value for all contributions) + explainer.expected_value must
    equal predict()'s raw output for the same input - the same identity
    verified directly against the shipped explainer during inspection."""
    raw_input = _dummy_input(loaded_service)
    prediction = loaded_service.predict(raw_input)

    all_contributions = loaded_service.explain(raw_input, top_n=len(loaded_service.feature_columns))
    assert all_contributions is not None
    assert len(all_contributions) == len(loaded_service.feature_columns)

    total_shap = sum(c["shap_value"] for c in all_contributions)
    assert total_shap + loaded_service._explainer.expected_value == pytest.approx(prediction, abs=1e-3)


def test_model2_explain_top_n_sorted_by_magnitude(loaded_service):
    raw_input = _dummy_input(loaded_service)
    top = loaded_service.explain(raw_input, top_n=5)
    assert top is not None
    assert len(top) == 5
    magnitudes = [abs(c["shap_value"]) for c in top]
    assert magnitudes == sorted(magnitudes, reverse=True)
    for c in top:
        assert c["direction"] in ("increases_prediction", "decreases_prediction")
        assert (c["shap_value"] >= 0) == (c["direction"] == "increases_prediction")

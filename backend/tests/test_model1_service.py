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


def test_model1_explainer_loads(loaded_service):
    assert loaded_service.explainer_loaded
    # Every raw feature column must be covered by the raw->transformed
    # index mapping (built from the preprocessor's own get_feature_names_out(),
    # validated at load time to cover all 119 transformed columns exactly once).
    assert set(loaded_service._raw_to_transformed_indices.keys()) == set(get_feature_columns())


def test_model1_explain_returns_positive_and_negative_contributors(loaded_service):
    explanation = loaded_service.explain(_dummy_feature_row(), top_n=5)
    assert explanation is not None
    assert len(explanation["positive_contributors"]) <= 5
    assert len(explanation["negative_contributors"]) <= 5
    assert len(explanation["positive_contributors"]) + len(explanation["negative_contributors"]) > 0

    for contributor in explanation["positive_contributors"]:
        assert contributor["shap_value"] > 0
        assert contributor["feature"] in get_feature_columns()
    for contributor in explanation["negative_contributors"]:
        assert contributor["shap_value"] < 0
        assert contributor["feature"] in get_feature_columns()


def test_model1_explain_positive_contributors_correspond_to_the_positive_class(loaded_service):
    """The core correctness requirement: a positive SHAP contribution must
    genuinely push the prediction TOWARD manganese_present (raise the
    margin/probability), not just be "the largest absolute value". Verified
    directly: summing every raw-aggregated SHAP contribution (top_n large
    enough to capture all of them) plus the explainer's own expected_value
    must reproduce predict_proba()[:, 1] via sigmoid, for the real model and
    a real input - not asserted against a mocked model."""
    import numpy as np

    row = _dummy_feature_row()
    prediction = loaded_service.predict(row)

    full_explanation = loaded_service.explain(row, top_n=len(get_feature_columns()))
    assert full_explanation is not None

    total_shap = sum(c["shap_value"] for c in full_explanation["positive_contributors"]) + sum(
        c["shap_value"] for c in full_explanation["negative_contributors"]
    )
    margin = total_shap + loaded_service._explainer.expected_value
    reconciled_probability = 1 / (1 + np.exp(-margin))

    assert reconciled_probability == pytest.approx(prediction["probability"], abs=1e-3)


def test_model1_explain_contributors_use_the_actual_input_values(loaded_service):
    row = _dummy_feature_row()
    row["dist_from_mine_m"] = 12345.0
    explanation = loaded_service.explain(row, top_n=len(get_feature_columns()))
    assert explanation is not None

    all_contributors = explanation["positive_contributors"] + explanation["negative_contributors"]
    dist_contributor = next(c for c in all_contributors if c["feature"] == "dist_from_mine_m")
    assert dist_contributor["input_value"] == 12345.0

    categorical_contributor = next(
        (c for c in all_contributors if c["feature"] == "surface_zone"), None
    )
    if categorical_contributor is not None:
        # The raw categorical value ("bare_rock_ore"), never a one-hot 0/1 flag.
        assert categorical_contributor["input_value"] == "bare_rock_ore"


def test_model1_explain_contributors_are_sorted_strongest_first(loaded_service):
    explanation = loaded_service.explain(_dummy_feature_row(), top_n=len(get_feature_columns()))
    assert explanation is not None

    positive_values = [c["shap_value"] for c in explanation["positive_contributors"]]
    assert positive_values == sorted(positive_values, reverse=True)

    negative_values = [c["shap_value"] for c in explanation["negative_contributors"]]
    assert negative_values == sorted(negative_values)  # most negative first


def test_model1_explain_top_n_is_configurable(loaded_service):
    row = _dummy_feature_row()
    top2 = loaded_service.explain(row, top_n=2)
    top5 = loaded_service.explain(row, top_n=5)
    assert top2 is not None and top5 is not None
    assert len(top2["positive_contributors"]) <= 2
    assert len(top2["negative_contributors"]) <= 2
    # A larger top_n must not drop any contributor a smaller top_n found -
    # same ordering, just more of it.
    assert top5["positive_contributors"][: len(top2["positive_contributors"])] == top2["positive_contributors"]


def test_model1_explain_returns_none_not_fabricated_data_on_missing_feature(loaded_service):
    """Explanation generation must fail closed: no partial/fabricated
    contributors for an input predict() itself would reject."""
    incomplete = _dummy_feature_row()
    del incomplete["terrain_elevation"]
    assert loaded_service.explain(incomplete) is None


def test_model1_explain_returns_none_when_explainer_unavailable():
    """If the explainer failed to build, explain() must return None rather
    than raise or fabricate - predict() must remain unaffected."""
    settings = get_settings()
    if not settings.model1_model_path.exists():
        pytest.skip("Model 1 artifacts not present in models/")
    svc = Model1Service()
    svc.load(settings)
    if not svc.is_loaded:
        pytest.skip("Model 1 failed to load in this environment.")

    svc._explainer = None
    assert svc.explain(_dummy_feature_row()) is None
    # predict() must still work with no explainer present.
    result = svc.predict(_dummy_feature_row())
    assert result["prediction"] in ("manganese_present", "manganese_absent")

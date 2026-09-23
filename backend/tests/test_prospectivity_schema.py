"""Pure schema-level tests for the Model 1 explainability additions to
ProspectivityResponse - no DB, no model artifacts."""
from app.schemas.prospectivity import (
    ProspectivityContributor,
    ProspectivityLocation,
    ProspectivityResponse,
)


def _base_response(**overrides) -> ProspectivityResponse:
    fields = {
        "location": ProspectivityLocation(latitude=21.85, longitude=80.26),
        "prediction": "manganese_present",
        "probability": 0.75,
        "decision_threshold": 0.8,
        "data_source": "existing_study_area",
        "features_used": ["dist_from_mine_m"],
    }
    fields.update(overrides)
    return ProspectivityResponse(**fields)


def test_recommended_exploration_measures_defaults_to_empty_list():
    """No validated Model 1 exploration rules exist in this repo - the field
    must default to [], never a fabricated recommendation."""
    response = _base_response()
    assert response.recommended_exploration_measures == []


def test_positive_and_negative_contributors_default_to_none():
    """None (not []) signals "explanation generation wasn't attempted/failed",
    distinct from an empty list meaning "the explainer ran and found nothing"."""
    response = _base_response()
    assert response.positive_contributors is None
    assert response.negative_contributors is None


def test_response_accepts_real_contributor_shape():
    response = _base_response(
        positive_contributors=[
            ProspectivityContributor(feature="dist_from_mine_m", label="dist_from_mine_m", input_value=500.0, shap_value=0.42)
        ],
        negative_contributors=[
            ProspectivityContributor(feature="soil_sand_60_100cm", label="soil_sand_60_100cm", input_value=16.7, shap_value=-0.55)
        ],
    )
    assert response.positive_contributors[0].shap_value == 0.42
    assert response.negative_contributors[0].shap_value == -0.55


def test_contributor_input_value_accepts_heterogeneous_types():
    """Raw Model 1 feature values are float (most), str (surface_zone), int
    (soil_wrb_class_code), or bool (terrain_available) - the schema must
    accept the actual value, not force a lossy cast."""
    for value in (500.0, "bare_rock_ore", 16, True):
        contributor = ProspectivityContributor(feature="x", label="x", input_value=value, shap_value=0.1)
        assert contributor.input_value == value


def test_existing_response_fields_are_unaffected_by_the_new_additive_fields():
    """Backward compatibility: constructing a response with only the
    pre-existing fields (no explanation data at all) must still work
    exactly as before."""
    response = _base_response()
    assert response.prediction == "manganese_present"
    assert response.probability == 0.75
    assert response.data_source == "existing_study_area"
    assert response.features_used == ["dist_from_mine_m"]

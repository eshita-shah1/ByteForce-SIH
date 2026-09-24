"""Pure unit tests for app.services.prospectivity_report - no DB, no model
artifacts. Verifies the redesigned technical-assessment report is built
entirely from a real (constructed-in-test) ProspectivityResponse, never a
second/duplicate prediction, never a fabricated SHAP value."""
from app.schemas.prospectivity import ProspectivityContributor, ProspectivityLocation, ProspectivityResponse
from app.services.prospectivity_report import build_prospectivity_report


def _contributor(feature: str, shap_value: float, input_value=1.0) -> ProspectivityContributor:
    return ProspectivityContributor(feature=feature, label=feature, input_value=input_value, shap_value=shap_value)


def _response(**overrides) -> ProspectivityResponse:
    fields = {
        "location": ProspectivityLocation(latitude=21.85, longitude=80.2275),
        "prediction": "manganese_present",
        "probability": 0.7842,
        "decision_threshold": 0.8,
        "data_source": "existing_study_area",
        "features_used": [
            "dist_from_mine_m",
            "env_LST_Celsius",
            "soil_clay_5_15cm",
            "terrain_slope_deg",
            "may_ndvi",
            "flood_risk_score_mean",
        ],
        "positive_contributors": [
            _contributor("dist_from_mine_m", 3.63, 83.57),
            _contributor("env_LST_Celsius", 0.48, 38.6),
            _contributor("may_ndvi", 0.12, 0.31),
            _contributor("terrain_slope_deg", 0.02, 4.1),  # negligible - should be filtered
        ],
        "negative_contributors": [
            _contributor("soil_clay_5_15cm", -0.92, 43.1),
            _contributor("flood_risk_score_mean", -0.01, 0.62),  # negligible - should be filtered
        ],
    }
    fields.update(overrides)
    return ProspectivityResponse(**fields)


def test_report_uses_the_real_prediction_values_not_hardcoded_ones():
    response = _response(probability=0.7842)
    report = build_prospectivity_report(response)
    assert report.prospectivity_percentage == 78.42
    assert "78.42%" in report.narrative
    assert report.predicted_class_label == "Manganese-present"
    assert report.assessment_summary.prospectivity == "78.42%"


def test_predicted_class_label_reflects_manganese_absent():
    response = _response(prediction="manganese_absent", probability=0.12)
    report = build_prospectivity_report(response)
    assert report.predicted_class_label == "Manganese-absent"
    assert report.assessment_summary.predicted_class == "Manganese-absent"


def test_supporting_and_limiting_factors_are_selected_from_real_shap_output():
    response = _response()
    report = build_prospectivity_report(response)

    supporting_features = {f.feature for f in report.supporting_factors}
    limiting_features = {f.feature for f in report.limiting_factors}

    assert supporting_features <= {c.feature for c in response.positive_contributors}
    assert limiting_features <= {c.feature for c in response.negative_contributors}
    # No contributor is fabricated: every displayed shap_value matches the source exactly.
    by_feature = {c.feature: c.shap_value for c in response.positive_contributors + response.negative_contributors}
    for factor in report.supporting_factors + report.limiting_factors:
        assert factor.shap_value == by_feature[factor.feature]


def test_negligible_contributors_are_filtered_from_the_curated_view():
    """terrain_slope_deg (shap=0.02) and flood_risk_score_mean (shap=-0.01)
    are far below 5% of the strongest contributor's magnitude (3.63) and
    must not appear in the curated report, even though they're real,
    non-fabricated contributors present in the raw API lists."""
    response = _response()
    report = build_prospectivity_report(response)

    report_features = {f.feature for f in report.supporting_factors + report.limiting_factors}
    assert "terrain_slope_deg" not in report_features
    assert "flood_risk_score_mean" not in report_features


def test_total_factor_count_is_capped_around_three_to_five():
    response = _response()
    report = build_prospectivity_report(response)
    total = len(report.supporting_factors) + len(report.limiting_factors)
    assert 1 <= total <= 5
    assert len(report.supporting_factors) <= 3
    assert len(report.limiting_factors) <= 2


def test_does_not_force_artificial_balance_when_one_side_has_no_meaningful_contributors():
    response = _response(
        positive_contributors=[_contributor("dist_from_mine_m", 3.63, 83.57)],
        negative_contributors=[_contributor("soil_clay_5_15cm", -0.02, 43.1)],  # negligible relative to 3.63
    )
    report = build_prospectivity_report(response)
    assert len(report.supporting_factors) == 1
    assert len(report.limiting_factors) == 0


def test_factor_directions_are_correctly_classified():
    response = _response()
    report = build_prospectivity_report(response)
    assert all(f.direction == "supporting" for f in report.supporting_factors)
    assert all(f.direction == "limiting" for f in report.limiting_factors)
    assert all(f.shap_value > 0 for f in report.supporting_factors)
    assert all(f.shap_value < 0 for f in report.limiting_factors)


def test_factor_explanations_do_not_claim_shap_proves_mineralization():
    response = _response()
    report = build_prospectivity_report(response)
    for factor in report.limiting_factors:
        assert "evidence against manganese mineralization" not in factor.explanation or "rather than" in factor.explanation
    for factor in report.supporting_factors + report.limiting_factors:
        assert "prove" not in factor.explanation.lower()
        assert "proof" not in factor.explanation.lower() or "not independent geological proof" in report.why_explanation


def test_exploration_plan_is_consolidated_not_one_per_feature():
    response = _response()
    report = build_prospectivity_report(response)
    # A small, fixed number of coherent actions - not one entry per SHAP contributor.
    assert 1 <= len(report.exploration_plan) <= 6
    total_factors = len(report.supporting_factors) + len(report.limiting_factors)
    assert len(report.exploration_plan) != total_factors or len(report.exploration_plan) <= 4
    for step in report.exploration_plan:
        assert "SHAP" not in step  # plan text stays feature/SHAP-agnostic


def test_exploration_plan_differs_for_absent_prediction():
    present = build_prospectivity_report(_response(prediction="manganese_present"))
    absent = build_prospectivity_report(_response(prediction="manganese_absent", probability=0.1))
    assert present.exploration_plan != absent.exploration_plan
    assert present.assessment_summary.overall_action != absent.assessment_summary.overall_action


def test_assessment_summary_fields_are_populated_dynamically():
    response = _response()
    report = build_prospectivity_report(response)
    summary = report.assessment_summary
    assert f"{response.location.latitude:.4f}" in summary.location
    assert f"{response.location.longitude:.4f}" in summary.location
    assert summary.prospectivity == f"{response.probability * 100:.2f}%"
    supporting_labels = {f.label for f in report.supporting_factors}
    for label in summary.supporting_factors.split(", "):
        assert label == "None identified" or label in supporting_labels


def test_report_handles_no_explanation_available_without_fabricating():
    """positive_contributors/negative_contributors both None (explainer
    failed server-side) - report must still build, with empty factor lists
    and an honest note, never fabricated contributors."""
    response = _response(positive_contributors=None, negative_contributors=None)
    report = build_prospectivity_report(response)
    assert report.supporting_factors == []
    assert report.limiting_factors == []
    assert "unavailable" in report.why_explanation.lower()


def test_narrative_does_not_expose_the_literal_other_group_when_named_groups_exist():
    response = _response(features_used=["dist_from_mine_m", "flood_risk_score_mean"])
    report = build_prospectivity_report(response)
    assert "other" not in report.narrative.lower().split()

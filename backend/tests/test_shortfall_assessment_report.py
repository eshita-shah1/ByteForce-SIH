"""Pure unit tests for app.services.shortfall_assessment_report - no DB, no
model artifacts. Verifies the detailed Model 2 assessment report is built
entirely from a real (constructed-in-test) ShortfallResponse + SHAP
contribution list, never a second prediction, never a fabricated value."""
from app.schemas.shortfall import ShortfallResponse
from app.services.shortfall_assessment_report import (
    ACTIONABLE_FEATURES,
    build_shortfall_assessment_report,
)


def _contribution(feature: str, shap_value: float, value: float = 1.0) -> dict:
    return {
        "feature": feature,
        "value": value,
        "shap_value": shap_value,
        "direction": "increases_prediction" if shap_value >= 0 else "decreases_prediction",
    }


def _response(**overrides) -> ShortfallResponse:
    fields = {
        "pit_id": "BAL_NORTH_PIT",
        "shift_type": "Shift_1_Morning",
        "target_production_tonnes": 550.0,
        "predicted_production_tonnes": 484.18,
        "shortfall_tonnes": 65.82,
        "shortfall_percentage": 11.97,
        "risk": "Alert",
        "primary_causes": [],
        "corrective_measures": [],
        "feature_sources": {},
    }
    fields.update(overrides)
    return ShortfallResponse(**fields)


# 15 real model features, sorted by |shap_value| descending, matching what
# model2_service.explain(top_n=15) actually returns.
FULL_CONTRIBUTIONS = [
    _contribution("target_production_tonnes", 41.32, 550.0),
    _contribution("equipment_downtime_hours", -15.03, 1.5),
    _contribution("planned_operating_hours", 15.01, 8.0),
    _contribution("dumper_cycle_time_minutes", -9.36, 68.5),
    _contribution("previous_day_production_tonnes", 6.00, 900.0),
    _contribution("excavators_available", 4.10, 6.0),
    _contribution("dump_trucks_operational", -3.50, 12.0),
    _contribution("workers_available", 2.80, 45.0),
    _contribution("cumulative_rainfall_72h", -2.20, 10.0),
    _contribution("soil_moisture_index", -1.80, 0.3),
    _contribution("surface_water_pooling_pct", -1.50, 5.0),
    _contribution("humidity_pct", 0.90, 60.0),
    _contribution("land_surface_temperature_c", -0.70, 28.0),
    _contribution("workers_scheduled", 0.40, 50.0),
    _contribution("previous_shift_production_tonnes", -0.10, 450.0),
]


def test_report_is_none_when_no_shap_contributions_available():
    response = _response()
    report = build_shortfall_assessment_report(response, None)
    assert report is None


def test_production_summary_uses_real_response_values_not_hardcoded():
    response = _response(target_production_tonnes=550.0, predicted_production_tonnes=484.18, risk="Alert")
    report = build_shortfall_assessment_report(response, FULL_CONTRIBUTIONS)
    summary = report.production_summary
    assert summary.target_production_tonnes == 550.0
    assert summary.predicted_production_tonnes == 484.18
    assert summary.risk_level == "Alert"


def test_why_section_shows_exactly_top_5_by_absolute_shap_magnitude():
    response = _response()
    report = build_shortfall_assessment_report(response, FULL_CONTRIBUTIONS)
    factors = report.why_model_produced_result.factors
    assert len(factors) == 5
    expected_order = [c["feature"] for c in FULL_CONTRIBUTIONS[:5]]
    assert [f.feature for f in factors] == expected_order


def test_why_section_directions_match_shap_sign():
    response = _response()
    report = build_shortfall_assessment_report(response, FULL_CONTRIBUTIONS)
    by_feature = {c["feature"]: c["shap_value"] for c in FULL_CONTRIBUTIONS}
    for factor in report.why_model_produced_result.factors:
        expected_direction = "positive" if by_feature[factor.feature] >= 0 else "negative"
        assert factor.direction == expected_direction
        assert factor.shap_contribution == by_feature[factor.feature]


def test_target_production_gets_planning_input_framing_not_operational_cause():
    response = _response()
    report = build_shortfall_assessment_report(response, FULL_CONTRIBUTIONS)
    target_factor = next(f for f in report.why_model_produced_result.factors if f.feature == "target_production_tonnes")
    assert "planning input" in target_factor.explanation
    assert "not a physical operational cause" in target_factor.explanation


def test_previous_production_fields_never_generate_corrective_measures():
    """previous_day_production_tonnes has shap=+6.00 (positive, wouldn't
    qualify anyway) and previous_shift_production_tonnes has shap=-0.10
    (negative) - but both are contextual, not actionable, so neither may
    ever appear in recommended_corrective_measures regardless of sign."""
    response = _response()
    report = build_shortfall_assessment_report(response, FULL_CONTRIBUTIONS)
    measure_features = {m.feature for m in report.recommended_corrective_measures.measures}
    assert "previous_day_production_tonnes" not in measure_features
    assert "previous_shift_production_tonnes" not in measure_features
    assert "target_production_tonnes" not in measure_features


def test_corrective_measures_only_for_negative_actionable_contributors():
    response = _response()
    report = build_shortfall_assessment_report(response, FULL_CONTRIBUTIONS)
    measures = report.recommended_corrective_measures.measures

    by_feature = {c["feature"]: c["shap_value"] for c in FULL_CONTRIBUTIONS}
    for m in measures:
        assert m.feature in ACTIONABLE_FEATURES
        assert by_feature[m.feature] < 0

    # Positive actionable contributors (excavators_available, workers_available,
    # humidity_pct, workers_scheduled) must NOT appear.
    measure_features = {m.feature for m in measures}
    assert "excavators_available" not in measure_features
    assert "workers_available" not in measure_features
    assert "humidity_pct" not in measure_features


def test_corrective_measures_scan_the_full_list_not_just_the_top_5():
    """land_surface_temperature_c (shap=-0.70) and surface_water_pooling_pct
    (shap=-1.50) are both outside the top-5-by-magnitude "why" factors, but
    are real negative actionable contributors and must still produce a
    corrective measure."""
    response = _response()
    report = build_shortfall_assessment_report(response, FULL_CONTRIBUTIONS)
    measure_features = {m.feature for m in report.recommended_corrective_measures.measures}
    assert "land_surface_temperature_c" in measure_features
    assert "surface_water_pooling_pct" in measure_features
    assert "soil_moisture_index" in measure_features
    assert "cumulative_rainfall_72h" in measure_features
    assert "dump_trucks_operational" in measure_features


def test_measures_are_sorted_strongest_first():
    response = _response()
    report = build_shortfall_assessment_report(response, FULL_CONTRIBUTIONS)
    magnitudes = [abs(m.shap_contribution) for m in report.recommended_corrective_measures.measures]
    assert magnitudes == sorted(magnitudes, reverse=True)


def test_no_negative_actionable_contributors_yields_honest_note_not_fabrication():
    all_positive = [_contribution(c["feature"], abs(c["shap_value"]), c["value"]) for c in FULL_CONTRIBUTIONS]
    response = _response()
    report = build_shortfall_assessment_report(response, all_positive)
    assert report.recommended_corrective_measures.measures == []
    assert report.recommended_corrective_measures.note is not None
    assert "No major actionable operational feature" in report.recommended_corrective_measures.note


def test_why_and_measures_sections_never_mismatch_for_shared_features():
    """A feature appearing in both the "why" top-5 and the corrective
    measures list must carry identical value/shap_contribution in both -
    same underlying SHAP data, no drift."""
    response = _response()
    report = build_shortfall_assessment_report(response, FULL_CONTRIBUTIONS)

    why_by_feature = {f.feature: (f.value, f.shap_contribution) for f in report.why_model_produced_result.factors}
    measure_by_feature = {m.feature: (m.value, m.shap_contribution) for m in report.recommended_corrective_measures.measures}

    shared = set(why_by_feature) & set(measure_by_feature)
    assert shared  # equipment_downtime_hours and dumper_cycle_time_minutes qualify for both
    for feature in shared:
        assert why_by_feature[feature] == measure_by_feature[feature]


def test_explanations_never_claim_proven_physical_causation():
    response = _response()
    report = build_shortfall_assessment_report(response, FULL_CONTRIBUTIONS)
    forbidden = ["caused exactly", "proves that", "shap proves"]
    for factor in report.why_model_produced_result.factors:
        lowered = factor.explanation.lower()
        for phrase in forbidden:
            assert phrase not in lowered


def test_labels_are_human_readable():
    response = _response()
    report = build_shortfall_assessment_report(response, FULL_CONTRIBUTIONS)
    labels = {f.feature: f.label for f in report.why_model_produced_result.factors}
    assert labels["dumper_cycle_time_minutes"] == "Dumper Cycle Time"
    assert labels["equipment_downtime_hours"] == "Equipment Downtime"


def test_every_actionable_feature_has_a_corrective_measure_template():
    """Guards against a silent gap: every feature in ACTIONABLE_FEATURES
    must have real measure text available, or it would KeyError at report
    time instead of silently omitting a real negative contributor."""
    from app.services.shortfall_assessment_report import _CORRECTIVE_MEASURES

    assert ACTIONABLE_FEATURES <= set(_CORRECTIVE_MEASURES.keys())


def test_every_model_feature_has_an_explanation_template():
    from app.services.shortfall_assessment_report import _EXPLANATION_TEMPLATES

    all_features = {c["feature"] for c in FULL_CONTRIBUTIONS}
    assert all_features <= set(_EXPLANATION_TEMPLATES.keys())
    for templates in _EXPLANATION_TEMPLATES.values():
        assert "positive" in templates and "negative" in templates

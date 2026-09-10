"""Pure unit tests for app.services.shortfall_report - no DB, no model
artifacts. Verifies the frontend-shaped report is built entirely from real
request/response values (see the module docstring for what's genuinely
derivable vs. explicitly labeled as unavailable)."""
from app.ml.model2.feature_schema import PIT_COORDINATES
from app.schemas.shortfall import CorrectiveMeasure, ShortfallRequest, ShortfallResponse
from app.services.shortfall_report import build_shortfall_report


def _valid_request(**overrides) -> ShortfallRequest:
    payload = {
        "timestamp": "2026-09-08T10:00:00",
        "shift_type": "Shift_1_Morning",
        "pit_id": "BAL_NORTH_PIT",
        "target_production_tonnes": 5000,
        "planned_operating_hours": 8,
        "surface_water_pooling_pct": 5,
        "pit_productivity_factor": 1.0,
        "fleet_health_score": 0.9,
        "excavators_scheduled": 5,
        "excavators_available": 5,
        "excavator_downtime_hours": 0,
        "equipment_maintenance_hours": 1,
        "dump_trucks_assigned": 10,
        "dump_trucks_operational": 10,
        "dumper_cycle_time_minutes": 12,
        "workers_scheduled": 50,
        "workers_available": 48,
        "worker_availability_pct": 96,
        "blasting_scheduled_flag": 1,
        "blasting_delay_hours": 0,
        "muckpile_volume_available": 1000,
        "blast_fragmentation_index": 0.5,
        "haul_road_condition_index": 4,
        "rock_hardness_ucs": 90,
        "stripping_ratio_current": 2.5,
        "ore_grade_expected_pct": 30,
        "operational_shock_flag": 0,
        "previous_shift_production_tonnes": 4800,
        "previous_day_production_tonnes": 9600,
    }
    payload.update(overrides)
    return ShortfallRequest(**payload)


def _response_with_measures(*measures: CorrectiveMeasure) -> ShortfallResponse:
    return ShortfallResponse(
        pit_id="BAL_NORTH_PIT",
        shift_type="Shift_1_Morning",
        target_production_tonnes=5000.0,
        predicted_production_tonnes=4200.0,
        shortfall_tonnes=800.0,
        shortfall_percentage=16.0,
        risk="Critical",
        primary_causes=[m.factor for m in measures],
        corrective_measures=list(measures),
        feature_sources={},
    )


def test_coordinates_come_from_real_pit_coordinates_table():
    request = _valid_request(pit_id="UKWA_EXTENSION")
    response = _response_with_measures(
        CorrectiveMeasure(factor="none", severity="low", action="Continue as planned.", reason="Nominal.")
    )

    report = build_shortfall_report(request, response)

    expected_lat, expected_lng = PIT_COORDINATES["UKWA_EXTENSION"]
    assert report.coordinates.lat == expected_lat
    assert report.coordinates.lng == expected_lng


def test_risk_level_mapping_is_deterministic():
    request = _valid_request()
    for backend_risk, frontend_risk in [("Normal", "LOW"), ("Alert", "MODERATE RISK"), ("Critical", "HIGH RISK")]:
        response = _response_with_measures(
            CorrectiveMeasure(factor="none", severity="low", action="x", reason="y")
        )
        response.risk = backend_risk
        report = build_shortfall_report(request, response)
        assert report.risk_level == frontend_risk


def test_contributing_factor_weights_sum_to_100_percent():
    request = _valid_request()
    response = _response_with_measures(
        CorrectiveMeasure(factor="excavator_downtime", severity="high", action="a", reason="r1"),
        CorrectiveMeasure(factor="rainfall", severity="medium", action="b", reason="r2"),
        CorrectiveMeasure(factor="rock_hardness", severity="low", action="c", reason="r3"),
    )

    report = build_shortfall_report(request, response)

    assert len(report.contributing_factors) == 3
    assert sum(f.impact_percent for f in report.contributing_factors) == 100
    # high severity gets more weight than low severity
    weights = {f.name: f.impact_percent for f in report.contributing_factors}
    assert weights["Excavator Downtime"] > weights["Rock Hardness"]


def test_unmodeled_fields_are_honestly_labeled_not_fabricated():
    request = _valid_request()
    response = _response_with_measures(
        CorrectiveMeasure(factor="none", severity="low", action="x", reason="y")
    )

    report = build_shortfall_report(request, response)

    assert "not modeled" in report.environmental.lightning_risk.lower()
    assert "not modeled" in report.environmental.water_table_risk.lower()
    assert "not assessed" in report.submitted_parameters.geological_profile.lower()


def test_corrective_measures_are_passed_through_verbatim():
    request = _valid_request()
    response = _response_with_measures(
        CorrectiveMeasure(factor="rainfall", severity="medium", action="Increase drainage effort.", reason="Heavy rain.")
    )

    report = build_shortfall_report(request, response)

    assert report.corrective_measures == ["Increase drainage effort."]

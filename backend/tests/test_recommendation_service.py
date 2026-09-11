from app.services.recommendation_service import build_recommendations, calculate_risk


def _base_inputs(**overrides):
    inputs = {
        "rainfall_intensity_mm": 0.0,
        "workers_available": 48,
        "workers_scheduled": 50,
    }
    inputs.update(overrides)
    return inputs


def test_calculate_risk_bands():
    # v2 thresholds: <10 Normal, 10-<25 Alert, >=25 Critical
    assert calculate_risk(0) == "Normal"
    assert calculate_risk(9.9) == "Normal"
    assert calculate_risk(10) == "Alert"
    assert calculate_risk(24.9) == "Alert"
    assert calculate_risk(25) == "Critical"
    assert calculate_risk(50) == "Critical"


def test_no_issues_yields_default_recommendation():
    causes, measures = build_recommendations(_base_inputs())
    assert causes == ["No major operational issue detected"]
    assert len(measures) == 1


def test_heavy_rainfall_flagged():
    causes, measures = build_recommendations(_base_inputs(rainfall_intensity_mm=30.0))
    assert "Heavy rainfall" in causes
    assert any(m.factor == "rainfall" and m.severity == "medium" for m in measures)


def test_low_worker_availability_flagged():
    causes, _ = build_recommendations(_base_inputs(workers_available=30, workers_scheduled=50))
    assert "Low worker availability" in causes


def test_worker_availability_above_threshold_not_flagged():
    causes, _ = build_recommendations(_base_inputs(workers_available=49, workers_scheduled=50))
    assert "Low worker availability" not in causes


def test_missing_rainfall_does_not_crash():
    inputs = _base_inputs()
    inputs["rainfall_intensity_mm"] = None
    causes, _ = build_recommendations(inputs)
    assert "Heavy rainfall" not in causes


def test_zero_workers_scheduled_does_not_crash():
    causes, _ = build_recommendations(_base_inputs(workers_available=0, workers_scheduled=0))
    assert "Low worker availability" not in causes


def test_obsolete_v1_rules_are_gone():
    """Regression test: rules keyed on fields the v2 model doesn't supply
    must not be triggerable even if those keys happen to be present."""
    inputs = _base_inputs()
    inputs.update(
        {
            "excavator_downtime_hours": 10,
            "dump_trucks_assigned": 10,
            "dump_trucks_operational": 1,
            "haul_road_condition_index": 0,
            "blasting_delay_hours": 10,
            "muckpile_volume_available": 0,
            "rock_hardness_ucs": 999,
        }
    )
    causes, measures = build_recommendations(inputs)
    obsolete_causes = {
        "Excavator downtime",
        "Dump truck availability",
        "Poor haul-road condition",
        "Blasting delay",
        "Low muckpile availability",
        "High rock hardness",
    }
    assert not (obsolete_causes & set(causes))

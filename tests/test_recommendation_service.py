from app.services.recommendation_service import build_recommendations, calculate_risk


def _base_inputs(**overrides):
    inputs = {
        "excavator_downtime_hours": 0.0,
        "dump_trucks_assigned": 10,
        "dump_trucks_operational": 10,
        "rainfall_intensity_mm": 0.0,
        "haul_road_condition_index": 5.0,
        "blasting_delay_hours": 0.0,
        "muckpile_volume_available": 1000.0,
        "worker_availability_pct": 98.0,
        "rock_hardness_ucs": 80.0,
    }
    inputs.update(overrides)
    return inputs


def test_calculate_risk_bands():
    assert calculate_risk(0) == "Normal"
    assert calculate_risk(5) == "Normal"
    assert calculate_risk(5.1) == "Alert"
    assert calculate_risk(15) == "Alert"
    assert calculate_risk(15.1) == "Critical"


def test_no_issues_yields_default_recommendation():
    causes, measures = build_recommendations(_base_inputs())
    assert causes == ["No major operational issue detected"]
    assert len(measures) == 1


def test_excavator_downtime_flagged():
    causes, measures = build_recommendations(_base_inputs(excavator_downtime_hours=3.0))
    assert "Excavator downtime" in causes
    assert any(m.factor == "excavator_downtime" and m.severity == "high" for m in measures)


def test_dump_truck_shortfall_flagged():
    causes, _ = build_recommendations(_base_inputs(dump_trucks_operational=5, dump_trucks_assigned=10))
    assert "Dump truck availability" in causes


def test_low_worker_availability_flagged():
    causes, _ = build_recommendations(_base_inputs(worker_availability_pct=70))
    assert "Low worker availability" in causes


def test_missing_rainfall_does_not_crash():
    inputs = _base_inputs()
    del inputs["rainfall_intensity_mm"]
    inputs["rainfall_intensity_mm"] = None
    causes, _ = build_recommendations(inputs)
    assert "Heavy rainfall" not in causes

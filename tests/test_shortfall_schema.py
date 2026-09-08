import pytest
from pydantic import ValidationError

from app.ml.model2.feature_schema import RAW_FEATURE_COLUMNS
from app.schemas.shortfall import ShortfallRequest


def _valid_payload(**overrides):
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
    return payload


def test_valid_payload_parses():
    req = ShortfallRequest(**_valid_payload())
    assert req.pit_id == "BAL_NORTH_PIT"


def test_rejects_unknown_shift_type():
    with pytest.raises(ValidationError):
        ShortfallRequest(**_valid_payload(shift_type="Shift_9_Bogus"))


def test_rejects_unknown_pit_id():
    with pytest.raises(ValidationError):
        ShortfallRequest(**_valid_payload(pit_id="NOT_A_REAL_PIT"))


def test_live_sourceable_fields_are_optional():
    payload = _valid_payload()
    req = ShortfallRequest(**payload)
    assert req.rainfall_intensity_mm is None
    assert req.soil_moisture_index is None


def test_request_fields_cover_pipeline_columns():
    """Every raw pipeline column (minus the timestamp-derived month/day_of_week)
    must be settable from the request schema - this is the regression test
    for the reference main.py schema mismatch discovered during inspection."""
    req = ShortfallRequest(**_valid_payload())
    dumped = req.model_dump()
    for col in RAW_FEATURE_COLUMNS:
        if col in ("month", "day_of_week"):
            continue
        assert col in dumped, f"{col} is required by the trained pipeline but missing from ShortfallRequest"

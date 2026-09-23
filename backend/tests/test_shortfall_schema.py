import json

import pytest
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.shortfall import ShortfallRequest


def _valid_payload(**overrides):
    payload = {
        "timestamp": "2026-09-08T10:00:00",
        "shift_type": "Shift_1_Morning",
        "pit_id": "BAL_NORTH_PIT",
        "target_production_tonnes": 550,
        "planned_operating_hours": 8,
        "surface_water_pooling_pct": 5,
        "excavators_available": 5,
        "dump_trucks_operational": 10,
        "workers_scheduled": 50,
        "workers_available": 48,
        "previous_shift_production_tonnes": 450,
        "previous_day_production_tonnes": 900,
        "equipment_downtime_hours": 1.5,
        "dumper_cycle_time_minutes": 18.0,
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
    assert req.humidity_pct is None
    assert req.land_surface_temperature_c is None


def test_missing_equipment_downtime_hours_is_rejected():
    payload = _valid_payload()
    del payload["equipment_downtime_hours"]
    with pytest.raises(ValidationError):
        ShortfallRequest(**payload)


def test_missing_dumper_cycle_time_minutes_is_rejected():
    payload = _valid_payload()
    del payload["dumper_cycle_time_minutes"]
    with pytest.raises(ValidationError):
        ShortfallRequest(**payload)


def test_request_fields_cover_v3_model_columns():
    """Every column models/model2_features.json declares (the v3 artifact's
    own shipped spec) must be settable from the request schema, directly
    or via a live-sourced field - the v3-model equivalent of the older v1/
    v2 pipeline-column coverage regression tests."""
    settings = get_settings()
    if not settings.model2_v3_features_path.exists():
        pytest.skip("model2_features.json not present in models/.")
    with open(settings.model2_v3_features_path, encoding="utf-8") as f:
        v3_columns = json.load(f)

    req = ShortfallRequest(**_valid_payload())
    dumped = req.model_dump()
    for col in v3_columns:
        assert col in dumped, f"{col} is required by the v3 model but missing from ShortfallRequest"


def test_target_production_tonnes_rejects_below_400():
    with pytest.raises(ValidationError):
        ShortfallRequest(**_valid_payload(target_production_tonnes=399))


def test_target_production_tonnes_rejects_above_600():
    with pytest.raises(ValidationError):
        ShortfallRequest(**_valid_payload(target_production_tonnes=601))


def test_target_production_tonnes_accepts_boundaries():
    assert ShortfallRequest(**_valid_payload(target_production_tonnes=400)).target_production_tonnes == 400
    assert ShortfallRequest(**_valid_payload(target_production_tonnes=600)).target_production_tonnes == 600


def test_obsolete_fields_are_no_longer_accepted():
    """Regression test: fields no artifact (v1, retired v2, or the live v3
    model) needs must not silently linger on the schema. Note
    land_surface_temperature_c and dumper_cycle_time_minutes are
    deliberately NOT in this set - v1 had them, v2 dropped them, and v3
    (2026-09-22) brought both back as real required/optional inputs."""
    obsolete_fields = {
        "pit_productivity_factor",
        "fleet_health_score",
        "excavators_scheduled",
        "excavator_downtime_hours",
        "equipment_maintenance_hours",
        "dump_trucks_assigned",
        "worker_availability_pct",
        "blasting_scheduled_flag",
        "blasting_delay_hours",
        "muckpile_volume_available",
        "blast_fragmentation_index",
        "haul_road_condition_index",
        "rock_hardness_ucs",
        "stripping_ratio_current",
        "ore_grade_expected_pct",
        "operational_shock_flag",
    }
    schema_fields = set(ShortfallRequest.model_fields.keys())
    leftover = obsolete_fields & schema_fields
    assert not leftover, f"Obsolete fields still present on ShortfallRequest: {leftover}"

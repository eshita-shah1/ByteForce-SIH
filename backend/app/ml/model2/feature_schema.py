"""Model 2 (production shortfall) feature schema.

Derived by directly unpickling and inspecting
`models/MOIL_Module2_Final_Model.pkl` (a dict: {"pipeline": <sklearn
Pipeline>, "model_type": "XGBoost Regressor", "target":
"actual_production_tonnes", "module": ..., "version": "1.0"}) and its
identical twin `models/moil_production_pipeline.pkl`.

Verified at inspection time:
  - pipeline.named_steps["preprocessor"] is a ColumnTransformer with
    feature_names_in_ == the 34 RAW_FEATURE_COLUMNS below (in this exact
    order), where "month" and "day_of_week" are ENGINEERED from a
    `timestamp` field, not raw user input.
  - The "categorical" transformer one-hot-encodes shift_type (3 known
    categories) and pit_id (4 known categories) with handle_unknown="ignore".
  - The "numerical" transformer is a plain passthrough (no imputer) - the
    final XGBRegressor step has missing=nan and handles NaN natively, so
    a genuinely-unavailable numeric feature does not crash inference, but
    the API layer still requires all fields since there is no live source
    for most of them.
  - pipeline.named_steps["model"] is an XGBRegressor, n_features_in_ == 37
    (32 numeric + 2 one-hot-expanded categorical groups of size 3 and 4),
    predicting `actual_production_tonnes`.

IMPORTANT: a reference `main.py` was supplied alongside these artifacts,
but its Pydantic `MiningInput` model does NOT match the pipeline's actual
expected columns (it uses "excavators_downtime_hours" instead of
"excavator_downtime_hours", "maintenance_hours" instead of
"equipment_maintenance_hours", and omits "workers_scheduled" /
"workers_available" entirely). This module uses the verified,
artifact-inspected column names as ground truth, not the reference script.
"""
from __future__ import annotations

TARGET_COLUMN = "actual_production_tonnes"

CATEGORICAL_FEATURES: dict[str, list[str]] = {
    "shift_type": ["Shift_1_Morning", "Shift_2_Evening", "Shift_3_Night"],
    "pit_id": ["BAL_DEEP_LEVEL_3", "BAL_NORTH_PIT", "BAL_SOUTH_PIT", "UKWA_EXTENSION"],
}

# Raw numeric feature columns the pipeline expects, in the pipeline's order.
NUMERIC_FEATURES: list[str] = [
    "target_production_tonnes",
    "planned_operating_hours",
    "rainfall_intensity_mm",
    "cumulative_rainfall_72h",
    "soil_moisture_index",
    "surface_water_pooling_pct",
    "land_surface_temperature_c",
    "pit_productivity_factor",
    "fleet_health_score",
    "excavators_scheduled",
    "excavators_available",
    "excavator_downtime_hours",
    "equipment_maintenance_hours",
    "dump_trucks_assigned",
    "dump_trucks_operational",
    "dumper_cycle_time_minutes",
    "workers_scheduled",
    "workers_available",
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
    "previous_shift_production_tonnes",
    "previous_day_production_tonnes",
]

# Engineered from `timestamp`, never supplied directly by the caller.
ENGINEERED_TIME_FEATURES: list[str] = ["month", "day_of_week"]

# Exact column order the fitted ColumnTransformer.feature_names_in_ expects.
RAW_FEATURE_COLUMNS: list[str] = (
    ["shift_type", "pit_id"] + NUMERIC_FEATURES + ENGINEERED_TIME_FEATURES
)

# Which fields plausibly have a live external-data source (weather/soil) vs.
# which must always come from the user (mine-operations-specific values with
# no generic public API). See services/external_data_service.py.
LIVE_SOURCEABLE_FEATURES: set[str] = {
    "rainfall_intensity_mm",
    "cumulative_rainfall_72h",
    "soil_moisture_index",
    "land_surface_temperature_c",
}

# Site coordinates used to query live weather/soil data per pit_id. These are
# approximate coordinates for the Balaghat/Bharveli manganese belt pits
# (derived from the existing study-area grid in SIH_Mining_Data), used only
# to pick a lat/lon for the external weather API call - NOT a claim about
# exact lease boundaries.
PIT_COORDINATES: dict[str, tuple[float, float]] = {
    "BAL_DEEP_LEVEL_3": (21.8500, 80.2275),
    "BAL_NORTH_PIT": (21.8700, 80.2275),
    "BAL_SOUTH_PIT": (21.8300, 80.2275),
    "UKWA_EXTENSION": (21.8500, 80.2450),
}

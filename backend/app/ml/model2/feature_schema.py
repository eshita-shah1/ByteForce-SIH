"""Model 2 (production shortfall) feature schema - v2 artifact.

The v1 artifact (models/backup_v1_shortfall_model/) was replaced with a new
Model 2 pipeline ("Model 2 Moil.pkl", copied in as both
models/MOIL_Module2_Final_Model.pkl and models/moil_production_pipeline.pkl).
Derived by directly unpickling and inspecting the new artifact - it is a
bare sklearn Pipeline (no {"pipeline", "target", ...} metadata dict, unlike
v1). Its target column name (actual_production_tonnes, same as v1) was
confirmed by the artifact's author, since the pickle itself carries no
embedded label.

Verified at inspection time:
  - pipeline.feature_names_in_ == the 16 RAW_FEATURE_COLUMNS below (pit_id,
    shift_type, then 12 numeric fields, then month/day_of_week), in this
    exact order. "month"/"day_of_week" are ENGINEERED from a `timestamp`
    field, not raw user input - same convention as v1.
  - "categorical" ColumnTransformer branch one-hot-encodes pit_id (4 known
    categories, unchanged from v1) and shift_type (3 known categories,
    unchanged from v1) with handle_unknown="ignore".
  - "numerical" branch is a plain passthrough (FunctionTransformer, no
    imputer) - the final XGBRegressor has missing=nan and handles NaN
    natively.
  - Final estimator is an XGBRegressor (objective=reg:squarederror,
    n_estimators=400, max_depth=6), n_features_in_ == 21 (4 + 3 one-hot
    columns + 14 passthrough numeric columns), no classes_ attribute (a
    regressor, not a classifier).

v1 -> v2: 17 fields removed, none renamed, none invented as replacements:
land_surface_temperature_c, pit_productivity_factor, fleet_health_score,
excavators_scheduled, excavator_downtime_hours, equipment_maintenance_hours,
dump_trucks_assigned, dumper_cycle_time_minutes, worker_availability_pct,
blasting_scheduled_flag, blasting_delay_hours, muckpile_volume_available,
blast_fragmentation_index, haul_road_condition_index, rock_hardness_ucs,
stripping_ratio_current, ore_grade_expected_pct, operational_shock_flag.
"""
from __future__ import annotations

TARGET_COLUMN = "actual_production_tonnes"

CATEGORICAL_FEATURES: dict[str, list[str]] = {
    "shift_type": ["Shift_1_Morning", "Shift_2_Evening", "Shift_3_Night"],
    "pit_id": ["BAL_DEEP_LEVEL_3", "BAL_NORTH_PIT", "BAL_SOUTH_PIT", "UKWA_EXTENSION"],
}

# Raw numeric feature columns the pipeline expects.
NUMERIC_FEATURES: list[str] = [
    "target_production_tonnes",
    "planned_operating_hours",
    "workers_available",
    "workers_scheduled",
    "excavators_available",
    "dump_trucks_operational",
    "rainfall_intensity_mm",
    "cumulative_rainfall_72h",
    "soil_moisture_index",
    "surface_water_pooling_pct",
    "previous_shift_production_tonnes",
    "previous_day_production_tonnes",
]

# Engineered from `timestamp`, never supplied directly by the caller.
ENGINEERED_TIME_FEATURES: list[str] = ["month", "day_of_week"]

# Matches pipeline.feature_names_in_'s exact order. (Column ORDER doesn't
# actually affect correctness here - the ColumnTransformer selects by name
# from the DataFrame - but this mirrors the real artifact for clarity.)
RAW_FEATURE_COLUMNS: list[str] = (
    ["pit_id", "shift_type"] + NUMERIC_FEATURES + ENGINEERED_TIME_FEATURES
)

# Which fields plausibly have a live external-data source (weather/soil) vs.
# which must always come from the user. See services/external_data_service.py.
# land_surface_temperature_c is gone in v2, so it's dropped from this set too.
LIVE_SOURCEABLE_FEATURES: set[str] = {
    "rainfall_intensity_mm",
    "cumulative_rainfall_72h",
    "soil_moisture_index",
}

# Site coordinates used to query live weather/soil data per pit_id - and to
# build the frontend-shaped shortfall report (app/services/shortfall_report.py).
# Unchanged from v1: same 4 pits.
PIT_COORDINATES: dict[str, tuple[float, float]] = {
    "BAL_DEEP_LEVEL_3": (21.8500, 80.2275),
    "BAL_NORTH_PIT": (21.8700, 80.2275),
    "BAL_SOUTH_PIT": (21.8300, 80.2275),
    "UKWA_EXTENSION": (21.8500, 80.2450),
}

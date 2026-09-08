"""Model 1 (manganese prospectivity) feature schema.

This is populated from `models/model_config.json`, which was extracted by
directly inspecting the trained artifacts (`preprocessor.pkl`'s
`feature_names_in_` / `xgboost_manganese_model.pkl`'s expected input width),
NOT invented. Loading it from the checked-in JSON (rather than unpickling)
lets DB DDL / import scripts build the exact same schema without requiring
sklearn/xgboost to be installed.

Verified at inspection time:
  - preprocessor.pkl: ColumnTransformer, 111 raw input columns -> 119 output
    columns (median-imputed numeric passthrough, most-frequent-imputed
    binary flag, most-frequent-imputed + one-hot-encoded categoricals).
  - xgboost_manganese_model.pkl: XGBClassifier, n_features_in_ == 119,
    classes_ == [0, 1], predict_proba()[:, 1] is the "manganese present"
    probability, thresholded at model_config.json["threshold"].
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

MODEL1_CONFIG_PATH = Path(__file__).resolve().parent.parent.parent.parent / "models" / "model_config.json"


@lru_cache
def load_model1_config() -> dict:
    with open(MODEL1_CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def get_feature_columns() -> list[str]:
    """All 111 raw feature columns, in the exact order preprocessor.pkl expects."""
    return list(load_model1_config()["feature_columns"])


def get_numeric_features() -> list[str]:
    return list(load_model1_config()["numeric_features"])


def get_binary_features() -> list[str]:
    return list(load_model1_config()["binary_features"])


def get_categorical_features() -> list[str]:
    return list(load_model1_config()["categorical_features"])


def get_target_column() -> str:
    return load_model1_config()["target"]


def get_decision_threshold() -> float:
    return float(load_model1_config()["threshold"])


# Known category values, discovered from preprocessor.pkl's fitted
# OneHotEncoder.categories_ at inspection time. Used for upload-mapping
# validation and API documentation; the ACTUAL encoding at inference time
# always comes from the loaded preprocessor itself, never from this list.
KNOWN_CATEGORY_VALUES: dict[str, list] = {
    "surface_zone": [
        "bare_rock_ore",
        "built_up",
        "dense_vegetation",
        "mixed_agricultural",
        "sparse_vegetation",
        "water_body",
        "waterlogged",
    ],
    "soil_wrb_class_code": [16, 18, 29],
}

# Human-readable grouping of feature columns, taken from the source project's
# own audited ml_feature_manifest.csv (SIH_Mining_Data/ALL CSV FILES/OUTPUT).
# Used only for documentation / dataset-requirement-registry display, not for
# inference logic.
FEATURE_GROUPS: dict[str, str] = {
    "dist_from_mine_m": "spatial_proximity_to_known_mine",
    "bearing_from_mine_deg": "spatial_proximity_to_known_mine",
    "is_mine_core_zone": "spatial_proximity_to_known_mine",
    "surface_zone": "land_cover",
    "soil_wrb_class_code": "soil",
    "terrain_available": "terrain",
}


def feature_group(column: str) -> str:
    if column in FEATURE_GROUPS:
        return FEATURE_GROUPS[column]
    if column.startswith(("may_", "aug_", "delta_", "mineral_score", "ore_pixel_ratio")):
        return "remote_sensing"
    if column.startswith("env_"):
        return "environment"
    if column.startswith("soil_"):
        return "soil"
    if column.startswith("terrain_"):
        return "terrain"
    return "other"

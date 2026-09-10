"""Existing-study-area spatial lookups against PostGIS.

Point-in-study-area / nearest-grid-cell logic reuses the SAME 212.13m
same-cell tolerance (300 * sqrt(2) / 2) that the source project's own
spatial joins were validated against (see
SIH_Mining_Data/.../ml_preprocessing.py: SAME_CELL_THRESHOLD_M), rather than
an arbitrary distance - the grid cells are 300m apart, so this tolerance is
exactly "closest cell, unless nothing is within half a cell-diagonal".
"""
from __future__ import annotations

import json

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.ml.model1.feature_schema import get_feature_columns


def get_study_area_geojson(db: Session) -> dict | None:
    row = db.execute(
        text(
            "SELECT ST_AsGeoJSON(geom::geometry) AS geojson, properties_json "
            "FROM study_area_boundary WHERE name = :name"
        ),
        {"name": "grid_footprint"},
    ).fetchone()
    if row is None:
        return None
    geometry = json.loads(row.geojson)
    properties = json.loads(row.properties_json) if row.properties_json else {}
    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": properties,
    }


def find_nearest_cell(db: Session, latitude: float, longitude: float, settings: Settings) -> dict | None:
    """Returns the nearest prospectivity_features row within
    settings.grid_match_tolerance_m, or None if nothing is close enough."""
    feature_columns = get_feature_columns()
    # Double-quoted: several feature columns are mixed-case (e.g. may_blue_B02),
    # and Postgres folds unquoted identifiers to lowercase - without quoting,
    # this SQL fails with "column ... does not exist" even though the
    # (case-preserved) column is right there.
    select_cols = ", ".join(f'"{c}"' for c in feature_columns)

    sql = text(
        f"""
        SELECT
            master_cell_id,
            latitude,
            longitude,
            label_source,
            manganese_present_ground_truth_reference,
            ST_Distance(geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography) AS distance_m,
            {select_cols}
        FROM prospectivity_features
        WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, :tolerance)
        ORDER BY geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
        LIMIT 1
        """
    )
    row = db.execute(
        sql,
        {"lon": longitude, "lat": latitude, "tolerance": settings.grid_match_tolerance_m},
    ).mappings().fetchone()
    return dict(row) if row else None

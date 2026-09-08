"""Imports the existing-study-area Model 1 dataset into PostGIS.

Source: data/final_prediction_dataset_850cells.csv (copied from
SIH_Mining_Data/ALL CSV FILES/OUTPUT/final_prediction_dataset_850cells.csv -
the same source file the project's own ml_preprocessing.py reads as
PRED_SRC). Only the columns Model 1 actually requires
(app.ml.model1.feature_schema.get_feature_columns()) plus identity/audit
columns are imported; everything else in that 169-column file (lithology
attributes, join-diagnostic distances, leakage-audited columns, etc.) is
intentionally left out, per the same feature manifest the model was
verified against.

Also derives and stores the authoritative study-area boundary as the union
of each 300m grid cell's footprint (a 150m square buffer around its center
point) - the 850-cell grid's real footprint, not a hand-drawn rectangle,
and not the much smaller OSM mine-lease polygon in data/study_boundary.geojson
(which is imported separately, for reference, under a different name).

Usage:
    python scripts/import_prospectivity_data.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd  # noqa: E402
from shapely.geometry import Point, mapping  # noqa: E402
from shapely.ops import unary_union  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.dialects.postgresql import insert as pg_insert  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.database import engine  # noqa: E402
from app.db.models import prospectivity_features, study_area_boundary  # noqa: E402
from app.ml.model1.feature_schema import (  # noqa: E402
    get_binary_features,
    get_feature_columns,
)

CSV_PATH = Path(__file__).resolve().parent.parent / "data" / "final_prediction_dataset_850cells.csv"
MINE_LEASE_GEOJSON = Path(__file__).resolve().parent.parent / "data" / "study_boundary.geojson"


def main() -> None:
    settings = get_settings()
    feature_columns = get_feature_columns()
    binary_features = set(get_binary_features())

    print(f"Reading {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)

    required_cols = {"master_cell_id", "master_row_idx", "master_col_idx", "latitude", "longitude"} | set(
        feature_columns
    )
    missing_cols = required_cols - set(df.columns)
    if missing_cols:
        raise SystemExit(f"Source CSV is missing required columns: {sorted(missing_cols)}")

    imported = 0
    rejected_coords = 0
    rejected_duplicate = 0
    seen_ids: set[str] = set()
    points: list[Point] = []
    rows_to_insert: list[dict] = []

    for _, row in df.iterrows():
        lat, lon = row["latitude"], row["longitude"]
        if not (-90 <= lat <= 90 and -180 <= lon <= 180) or pd.isna(lat) or pd.isna(lon):
            rejected_coords += 1
            continue

        cell_id = row["master_cell_id"]
        if cell_id in seen_ids:
            rejected_duplicate += 1
            continue
        seen_ids.add(cell_id)

        record = {
            "master_cell_id": cell_id,
            "master_row_idx": int(row["master_row_idx"]),
            "master_col_idx": int(row["master_col_idx"]),
            "latitude": float(lat),
            "longitude": float(lon),
            "geom": f"SRID=4326;POINT({lon} {lat})",
            "label_source": row.get("label_source"),
            "manganese_present_ground_truth_reference": (
                float(row["manganese_present"]) if pd.notna(row.get("manganese_present")) else None
            ),
        }
        for col in feature_columns:
            value = row[col]
            if col in binary_features:
                record[col] = bool(value) if pd.notna(value) else None
            elif pd.isna(value):
                record[col] = None
            else:
                record[col] = value

        rows_to_insert.append(record)
        points.append(Point(lon, lat))
        imported += 1

    print(f"Prepared {imported} rows (rejected: {rejected_coords} invalid coords, {rejected_duplicate} duplicates)")

    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE prospectivity_features"))
        for i in range(0, len(rows_to_insert), 200):
            batch = rows_to_insert[i : i + 200]
            stmt = pg_insert(prospectivity_features).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=["master_cell_id"],
                set_={c.name: stmt.excluded[c.name] for c in prospectivity_features.columns if c.name != "id"},
            )
            conn.execute(stmt)
    print(f"Imported: {imported}")

    # --- study-area boundary: union of 150m-radius square buffers around each cell center ---
    half = settings.grid_cell_size_m / 2
    # Buffer in a local equirectangular-ish approximation is adequate for a
    # ~9km-wide study area; cap_style=3 gives square buffers matching the
    # grid cell shape rather than circles.
    import math

    from shapely.geometry import Polygon

    lat0 = df["latitude"].mean()
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = 111_320.0 * math.cos(math.radians(lat0))
    dx = half / m_per_deg_lon
    dy = half / m_per_deg_lat

    squares = [
        Polygon(
            [
                (p.x - dx, p.y - dy),
                (p.x + dx, p.y - dy),
                (p.x + dx, p.y + dy),
                (p.x - dx, p.y + dy),
            ]
        )
        for p in points
    ]
    footprint = unary_union(squares)
    print(f"Study-area footprint derived from {len(squares)} grid cells (area of geometry union computed).")

    with engine.begin() as conn:
        conn.execute(text("DELETE FROM study_area_boundary WHERE name IN ('grid_footprint', 'mine_lease')"))
        conn.execute(
            text(
                "INSERT INTO study_area_boundary (name, geom, properties_json) "
                "VALUES (:name, ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326)::geography, :props)"
            ),
            {
                "name": "grid_footprint",
                "geojson": json.dumps(mapping(footprint)),
                "props": json.dumps(
                    {
                        "source": "final_prediction_dataset_850cells.csv",
                        "n_cells": len(squares),
                        "cell_size_m": settings.grid_cell_size_m,
                        "description": "Union of each 300m grid cell footprint - the actual queryable extent.",
                    }
                ),
            },
        )

        if MINE_LEASE_GEOJSON.exists():
            with open(MINE_LEASE_GEOJSON, encoding="utf-8") as f:
                mine_geojson = json.load(f)
            mine_geom = mine_geojson["features"][0]["geometry"]
            mine_props = mine_geojson["features"][0].get("properties", {})
            conn.execute(
                text(
                    "INSERT INTO study_area_boundary (name, geom, properties_json) "
                    "VALUES (:name, ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326)::geography, :props)"
                ),
                {
                    "name": "mine_lease",
                    "geojson": json.dumps(mine_geom),
                    "props": json.dumps(
                        {**mine_props, "description": "OSM Bharveli Manganese Mine lease polygon (reference only)."}
                    ),
                },
            )
            print("Stored mine-lease reference polygon from data/study_boundary.geojson.")

    print("\nSummary")
    print("=======")
    print(f"Imported: {imported}")
    print(f"Rejected (invalid coordinates): {rejected_coords}")
    print(f"Rejected (duplicate master_cell_id): {rejected_duplicate}")
    print("Study-area boundary stored as 'grid_footprint'.")


if __name__ == "__main__":
    main()

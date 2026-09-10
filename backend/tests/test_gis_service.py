"""Requires a full environment (DB driver + a reachable Postgres/PostGIS
with prospectivity_features created - see scripts/init_db.py). Regression
test for the mixed-case column bug in gis_service.find_nearest_cell (e.g.
may_blue_B02): Postgres folds unquoted identifiers to lowercase, so the raw
SQL there must double-quote every interpolated feature column name."""
import uuid

import pytest


def test_find_nearest_cell_does_not_crash_on_mixed_case_columns():
    pytest.importorskip("psycopg")
    from sqlalchemy import text

    from app.core.config import get_settings
    from app.db.database import SessionLocal
    from app.ml.model1.feature_schema import (
        get_binary_features,
        get_categorical_features,
        get_feature_columns,
        get_numeric_features,
    )
    from app.services import gis_service

    settings = get_settings()
    feature_columns = get_feature_columns()
    binary_features = set(get_binary_features())
    categorical_features = set(get_categorical_features())
    assert any(c != c.lower() for c in feature_columns), (
        "expected at least one mixed-case feature column (e.g. may_blue_B02) "
        "for this regression test to be meaningful"
    )

    db = SessionLocal()
    cell_id = f"TEST_{uuid.uuid4().hex[:8]}"
    lat, lon = 21.9, 80.3
    try:
        columns_sql = ", ".join(f'"{c}"' for c in feature_columns)
        placeholders_sql = ", ".join(f":{c}" for c in feature_columns)

        # Type-appropriate dummy values per column - the underlying Postgres
        # columns are typed per app/db/models.py (Float/Boolean/String from
        # the same get_numeric/binary/categorical_features() split), so an
        # arbitrary column needs a value of the right type to insert at all.
        params: dict = {}
        for c in feature_columns:
            if c in binary_features:
                params[c] = True
            elif c in categorical_features:
                params[c] = "test"
            else:
                params[c] = 0.1
        params.update(
            {
                "master_cell_id": cell_id,
                "lat": lat,
                "lon": lon,
            }
        )
        db.execute(
            text(
                f"""
                INSERT INTO prospectivity_features
                    (master_cell_id, latitude, longitude, geom, {columns_sql})
                VALUES
                    (:master_cell_id, :lat, :lon,
                     ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                     {placeholders_sql})
                """
            ),
            params,
        )
        db.commit()

        result = gis_service.find_nearest_cell(db, lat, lon, settings)

        assert result is not None
        assert result["master_cell_id"] == cell_id
        for col in feature_columns:
            assert col in result, f"{col} missing from find_nearest_cell result"
    finally:
        db.execute(
            text("DELETE FROM prospectivity_features WHERE master_cell_id = :id"),
            {"id": cell_id},
        )
        db.commit()
        db.close()

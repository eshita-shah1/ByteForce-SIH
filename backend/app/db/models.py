"""Database schema.

- prospectivity_features: one row per existing-study-area 300m grid cell,
  holding exactly the Model 1 raw feature columns (from
  app.ml.model1.feature_schema) plus a PostGIS geography Point and identity/
  audit columns. Built as a Core Table (not declarative ORM) because its
  feature columns are generated programmatically from the same schema the
  model/preprocessor were verified against, keeping a single source of truth.
- study_area_boundary: one row holding the authoritative study-area polygon
  (derived from the 850-cell grid footprint; see scripts/import_prospectivity_data.py)
  and, separately, the small OSM mine-lease polygon shipped in data/study_boundary.geojson.
- uploads / upload_files: session-based tracking for the "non-existing study
  area" upload workflow. Uploaded datasets are NOT merged into
  prospectivity_features.
"""
from __future__ import annotations

import datetime as dt

from geoalchemy2 import Geography
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import DeclarativeBase

from app.ml.model1.feature_schema import (
    get_binary_features,
    get_categorical_features,
    get_numeric_features,
)

metadata = MetaData()


class Base(DeclarativeBase):
    metadata = metadata


# --- prospectivity_features -------------------------------------------------

_numeric_columns = [Column(name, Float, nullable=True) for name in get_numeric_features()]
_binary_columns = [Column(name, Boolean, nullable=True) for name in get_binary_features()]
_categorical_columns = [Column(name, String, nullable=True) for name in get_categorical_features()]

prospectivity_features = Table(
    "prospectivity_features",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("master_cell_id", String, unique=True, nullable=False, index=True),
    Column("master_row_idx", Integer, nullable=True),
    Column("master_col_idx", Integer, nullable=True),
    Column("latitude", Float, nullable=False),
    Column("longitude", Float, nullable=False),
    Column("geom", Geography(geometry_type="POINT", srid=4326), nullable=False),
    Column("label_source", String, nullable=True),
    Column("manganese_present_ground_truth_reference", Float, nullable=True),
    *_numeric_columns,
    *_binary_columns,
    *_categorical_columns,
    Column("created_at", DateTime(timezone=True), default=dt.datetime.utcnow),
    Index("idx_prospectivity_geom", "geom", postgresql_using="gist"),
)


# --- study_area_boundary -----------------------------------------------------

study_area_boundary = Table(
    "study_area_boundary",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("name", String, unique=True, nullable=False),
    Column("geom", Geography(geometry_type="GEOMETRY", srid=4326), nullable=False),
    Column("properties_json", Text, nullable=True),
    Column("created_at", DateTime(timezone=True), default=dt.datetime.utcnow),
)


# --- uploads / upload_files (ORM) --------------------------------------------


class Upload(Base):
    __tablename__ = "uploads"

    id: str = Column(String, primary_key=True)  # upload_id (uuid4 hex)
    status: str = Column(String, nullable=False, default="processing")  # processing|validated|failed
    created_at = Column(DateTime(timezone=True), default=dt.datetime.utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    detected_crs = Column(String, nullable=True)
    bounds_json = Column(Text, nullable=True)  # JSON [minx, miny, maxx, maxy] in EPSG:4326

    available_features_json = Column(Text, nullable=True)  # JSON list[str]
    missing_features_json = Column(Text, nullable=True)  # JSON list[str]
    feature_sources_json = Column(Text, nullable=True)  # JSON {feature: source_filename}

    validation_result_json = Column(Text, nullable=True)  # JSON DatasetValidationResult
    error_message = Column(Text, nullable=True)


class UploadFile(Base):
    __tablename__ = "upload_files"

    id = Column(Integer, primary_key=True, autoincrement=True)
    upload_id = Column(String, nullable=False, index=True)
    original_filename = Column(String, nullable=False)
    stored_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # geotiff|shapefile|csv|geojson
    size_bytes = Column(Integer, nullable=False)
    detected_crs = Column(String, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=dt.datetime.utcnow)


# --- model_run_logs (ORM) -----------------------------------------------------
# Audit trail of Model 1 / Model 2 predictions, backing GET /api/logs (the
# frontend's "Model Execution Logs" view). Written by the prospectivity/
# shortfall routers right after a successful prediction.


class ModelRunLog(Base):
    __tablename__ = "model_run_logs"

    id = Column(String, primary_key=True)  # uuid4 hex
    model_type = Column(String, nullable=False)  # "Prospectivity" | "Shortfall"
    title = Column(String, nullable=False)
    target_site = Column(String, nullable=False)
    status = Column(String, nullable=False, default="Completed")  # Completed|Pending|Flagged
    metric_highlight = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=dt.datetime.utcnow, nullable=False, index=True)

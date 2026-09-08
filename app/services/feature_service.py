"""Dataset requirement registry + fallback feature extraction for the
"non-existing study area" (uploaded GIS data) Model 1 workflow.

For each of Model 1's 111 required raw features, this tries to extract a
value for the user-selected point from the uploaded files:
  1. Try an EXACT (normalized) name match against every uploaded source
     (raster filename/band description, vector attribute column, CSV
     column).
  2. If nothing matched exactly, try a documented synonym list (e.g.
     "elevation"/"dem"/"altitude" -> terrain_elevation). Synonyms are only
     used within the same physical quantity - never across unrelated
     concepts (RULE 10).
  3. If still nothing, the feature is reported MISSING and prediction is
     refused (RULE 11) - no fabricated values are ever fed to the model.

This is necessarily a best-effort name/synonym matcher: Model 1's schema
includes highly specific derived remote-sensing bands/indices
(may_swir1_B11, delta_ndvi, mineral_score_mean, ...) that generic user
uploads are very unlikely to reproduce exactly. The dataset validation
response is the mechanism for making that gap visible to the user, per the
spec's "Dataset Validation" checklist requirement, rather than silently
guessing.
"""
from __future__ import annotations

import logging
import os
import re

import geopandas as gpd
import pandas as pd

from app.ml.model1.feature_schema import get_feature_columns
from app.schemas.upload import FeatureCheck
from app.services import csv_service, raster_service, vector_service

logger = logging.getLogger("app.feature_service")

# feature_name -> extra keyword synonyms (all lowercase, underscore-joined)
SYNONYMS: dict[str, list[str]] = {
    "terrain_elevation": ["elevation", "dem", "altitude", "height"],
    "terrain_slope_deg": ["slope"],
    "terrain_aspect_deg": ["aspect"],
    "terrain_curvature": ["curvature"],
    "terrain_terrain_ruggedness": ["ruggedness", "tri_riley", "terrain_ruggedness_index"],
    "terrain_TPI": ["tpi", "topographic_position_index"],
    "terrain_TRI": ["tri", "terrain_ruggedness_index"],
    "env_NDVI": ["ndvi"],
    "env_LST_Celsius": ["lst", "land_surface_temperature"],
    "dist_from_mine_m": ["distance_to_mine", "dist_to_mine"],
    "bearing_from_mine_deg": ["bearing_to_mine"],
    "surface_zone": ["landcover", "land_cover", "landuse", "land_use"],
    "soil_wrb_class_code": ["wrb_class", "soil_class", "soil_type"],
}
for _depth in ["0_5cm", "5_15cm", "15_30cm", "30_60cm", "60_100cm", "100_200cm"]:
    for _prop, _keys in [
        ("phh2o", ["ph"]),
        ("clay", ["clay"]),
        ("sand", ["sand"]),
        ("silt", ["silt"]),
        ("soc", ["soc", "organic_carbon"]),
        ("bdod", ["bdod", "bulk_density"]),
        ("cec", ["cec"]),
        ("cfvo", ["cfvo", "coarse_fragments"]),
    ]:
        SYNONYMS.setdefault(f"soil_{_prop}_{_depth}", []).extend(_keys)


def _normalize(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


class SourceIndex:
    """Indexes every uploaded file's available column/band/filename tokens
    so features can be matched by name without re-parsing files repeatedly."""

    def __init__(self, upload_files: list) -> None:
        self.raster_files: list[dict] = []
        self.vector_files: list[dict] = []
        self.csv_files: list[dict] = []

        for uf in upload_files:
            if uf.file_type == "geotiff":
                _, meta = raster_service.inspect_geotiff(uf.stored_path, uf.original_filename)
                tokens = {_normalize(os.path.splitext(uf.original_filename)[0])}
                for desc in meta.get("descriptions") or []:
                    if desc:
                        tokens.add(_normalize(desc))
                self.raster_files.append({"filename": uf.original_filename, "path": uf.stored_path, "tokens": tokens})
            elif uf.file_type in ("shapefile", "geojson"):
                try:
                    gdf = gpd.read_file(uf.stored_path)
                except Exception:  # noqa: BLE001
                    continue
                self.vector_files.append(
                    {
                        "filename": uf.original_filename,
                        "gdf": gdf,
                        "columns": {_normalize(c): c for c in gdf.columns if c != "geometry"},
                    }
                )
            elif uf.file_type == "csv":
                try:
                    df = pd.read_csv(uf.stored_path)
                except Exception:  # noqa: BLE001
                    continue
                lat_col = csv_service.find_column(list(df.columns), csv_service.LAT_CANDIDATES)
                lon_col = csv_service.find_column(list(df.columns), csv_service.LON_CANDIDATES)
                self.csv_files.append(
                    {
                        "filename": uf.original_filename,
                        "df": df,
                        "lat_col": lat_col,
                        "lon_col": lon_col,
                        "columns": {_normalize(c): c for c in df.columns},
                    }
                )

    def _candidate_names(self, feature: str) -> list[str]:
        return [_normalize(feature)] + [_normalize(s) for s in SYNONYMS.get(feature, [])]

    def find_source(self, feature: str) -> tuple[str, dict, str] | None:
        """Returns (kind, source, matched_column_or_None) for the first
        matching source, or None. kind in {"raster","vector","csv"}."""
        candidates = self._candidate_names(feature)

        for r in self.raster_files:
            if any(c in r["tokens"] or any(c in t for t in r["tokens"]) for c in candidates):
                return "raster", r, None

        for v in self.vector_files:
            for c in candidates:
                if c in v["columns"]:
                    return "vector", v, v["columns"][c]

        for csvf in self.csv_files:
            for c in candidates:
                if c in csvf["columns"]:
                    return "csv", csvf, csvf["columns"][c]

        return None

    def resolve_features(self, latitude: float, longitude: float) -> tuple[dict, list[FeatureCheck]]:
        resolved: dict = {}
        checks: list[FeatureCheck] = []

        for feature in get_feature_columns():
            match = self.find_source(feature)
            if match is None:
                checks.append(FeatureCheck(feature=feature, found=False, note="No matching source found in uploaded files."))
                continue

            kind, source, column = match
            try:
                if kind == "raster":
                    value = raster_service.sample_point(source["path"], latitude, longitude)
                    method = "raster_sample"
                elif kind == "vector":
                    attrs = vector_service.extract_at_point(source["gdf"], latitude, longitude)
                    value = attrs.get(column) if attrs else None
                    method = "vector_join"
                else:  # csv
                    if source["lat_col"] and source["lon_col"]:
                        row = csv_service.extract_at_point(
                            source["df"], source["lat_col"], source["lon_col"], latitude, longitude
                        )
                        value = row.get(column) if row else None
                    else:
                        value = None
                    method = "csv_column"
            except Exception as exc:  # noqa: BLE001
                logger.warning("Extraction failed for %s from %s: %s", feature, source["filename"], exc)
                value = None
                method = kind

            if value is None:
                checks.append(
                    FeatureCheck(
                        feature=feature,
                        found=False,
                        source_file=source["filename"],
                        method=method,
                        note="Matched a source but could not extract a value at this location (out of coverage / NoData).",
                    )
                )
                continue

            resolved[feature] = value
            checks.append(
                FeatureCheck(feature=feature, found=True, source_file=source["filename"], method=method)
            )

        return resolved, checks

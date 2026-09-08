"""Shapefile / GeoJSON inspection & extraction (GeoPandas + Shapely)."""
from __future__ import annotations

import logging

import geopandas as gpd
from shapely.geometry import Point

from app.schemas.upload import FileValidationResult

logger = logging.getLogger("app.vector")


def inspect_vector(path: str, filename: str, file_type: str) -> tuple[FileValidationResult, gpd.GeoDataFrame | None]:
    errors: list[str] = []
    warnings: list[str] = []

    try:
        gdf = gpd.read_file(path)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to read vector file %s: %s", filename, exc)
        return (
            FileValidationResult(filename=filename, file_type=file_type, readable=False, errors=[str(exc)]),
            None,
        )

    if gdf.empty:
        errors.append("Dataset contains zero features.")

    invalid_count = int((~gdf.geometry.is_valid).sum()) if not gdf.empty else 0
    if invalid_count:
        warnings.append(f"{invalid_count} feature(s) have invalid geometry.")

    detected_crs = gdf.crs.to_string() if gdf.crs else None
    if gdf.crs is None:
        warnings.append("No CRS detected; assuming EPSG:4326.")
        gdf = gdf.set_crs(epsg=4326)

    bounds4326 = None
    try:
        gdf_4326 = gdf.to_crs(epsg=4326) if gdf.crs.to_epsg() != 4326 else gdf
        b = gdf_4326.total_bounds
        bounds4326 = [float(v) for v in b]
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"Could not compute EPSG:4326 bounds: {exc}")

    result = FileValidationResult(
        filename=filename,
        file_type=file_type,
        readable=not errors,
        detected_crs=detected_crs,
        bounds=bounds4326,
        errors=errors,
        warnings=warnings,
    )
    return result, (gdf if not errors else None)


def extract_at_point(gdf: gpd.GeoDataFrame, latitude: float, longitude: float) -> dict | None:
    """Returns the attributes of the feature containing (or, for point
    layers, nearest to) the given location, transformed into the layer's
    own CRS first. None if nothing matches."""
    point_4326 = gpd.GeoSeries([Point(longitude, latitude)], crs="EPSG:4326")
    point = point_4326.to_crs(gdf.crs).iloc[0]

    is_point_layer = gdf.geom_type.isin(["Point", "MultiPoint"]).all()
    if is_point_layer:
        distances = gdf.geometry.distance(point)
        idx = distances.idxmin()
        row = gdf.loc[idx]
    else:
        matches = gdf[gdf.geometry.contains(point)]
        if matches.empty:
            matches = gdf[gdf.geometry.intersects(point.buffer(1e-9))]
        if matches.empty:
            return None
        row = matches.iloc[0]

    attrs = row.drop(labels="geometry").to_dict()
    return attrs

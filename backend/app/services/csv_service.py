"""CSV inspection & extraction (pandas)."""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from app.schemas.upload import FileValidationResult

logger = logging.getLogger("app.csv")

LAT_CANDIDATES = {"latitude", "lat", "y"}
LON_CANDIDATES = {"longitude", "lon", "lng", "long", "x"}


def find_column(columns: list[str], candidates: set[str]) -> str | None:
    lower_map = {c.lower(): c for c in columns}
    for cand in candidates:
        if cand in lower_map:
            return lower_map[cand]
    return None


def inspect_csv(path: str, filename: str) -> tuple[FileValidationResult, pd.DataFrame | None, str | None, str | None]:
    errors: list[str] = []
    warnings: list[str] = []

    try:
        df = pd.read_csv(path)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to read CSV %s: %s", filename, exc)
        return (
            FileValidationResult(filename=filename, file_type="csv", readable=False, errors=[str(exc)]),
            None,
            None,
            None,
        )

    if df.empty:
        errors.append("CSV contains zero rows.")

    lat_col = find_column(list(df.columns), LAT_CANDIDATES)
    lon_col = find_column(list(df.columns), LON_CANDIDATES)

    bounds4326 = None
    if lat_col and lon_col:
        lat_series = pd.to_numeric(df[lat_col], errors="coerce")
        lon_series = pd.to_numeric(df[lon_col], errors="coerce")
        n_invalid = int((lat_series.isna() | lon_series.isna()).sum())
        if n_invalid:
            warnings.append(f"{n_invalid} row(s) have non-numeric or missing coordinates.")
        out_of_range = int(((lat_series.abs() > 90) | (lon_series.abs() > 180)).sum())
        if out_of_range:
            warnings.append(f"{out_of_range} row(s) have out-of-range coordinates.")
        valid = lat_series.between(-90, 90) & lon_series.between(-180, 180)
        if valid.any():
            bounds4326 = [
                float(lon_series[valid].min()),
                float(lat_series[valid].min()),
                float(lon_series[valid].max()),
                float(lat_series[valid].max()),
            ]
    else:
        warnings.append("No latitude/longitude columns detected; CSV can only be used as a non-spatial fallback source.")

    dup_count = int(df.duplicated().sum())
    if dup_count:
        warnings.append(f"{dup_count} duplicate row(s) found.")

    result = FileValidationResult(
        filename=filename,
        file_type="csv",
        readable=not errors,
        detected_crs="EPSG:4326" if lat_col and lon_col else None,
        bounds=bounds4326,
        errors=errors,
        warnings=warnings,
    )
    return result, (df if not errors else None), lat_col, lon_col


def extract_at_point(
    df: pd.DataFrame, lat_col: str, lon_col: str, latitude: float, longitude: float, tolerance_deg: float = 0.01
) -> dict | None:
    """Nearest-row lookup for point-based CSV data. tolerance_deg (~1.1km at
    the equator) is a coarse sanity bound - this is only used as a
    fallback source, not the primary spatial join."""
    lat_series = pd.to_numeric(df[lat_col], errors="coerce")
    lon_series = pd.to_numeric(df[lon_col], errors="coerce")
    dist = np.sqrt((lat_series - latitude) ** 2 + (lon_series - longitude) ** 2)
    if dist.isna().all():
        return None
    idx = dist.idxmin()
    if dist.loc[idx] > tolerance_deg:
        return None
    return df.loc[idx].to_dict()

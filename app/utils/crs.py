"""Reusable CRS detection/transformation helpers (pyproj), shared by every
GIS extraction service so raster/vector/CSV handling all transform
coordinates the same way."""
from __future__ import annotations

from functools import lru_cache

from pyproj import CRS, Transformer

WGS84 = CRS.from_epsg(4326)


@lru_cache(maxsize=64)
def _cached_transformer(src_epsg_or_wkt: str, dst_epsg_or_wkt: str) -> Transformer:
    return Transformer.from_crs(src_epsg_or_wkt, dst_epsg_or_wkt, always_xy=True)


def transform_point(lon: float, lat: float, src_crs: CRS, dst_crs: CRS = WGS84) -> tuple[float, float]:
    """Transforms a single (lon, lat)-ordered point between CRSs. No-ops if
    the CRSs are already equal (avoids needless precision drift)."""
    if src_crs == dst_crs:
        return lon, lat
    transformer = _cached_transformer(src_crs.to_wkt(), dst_crs.to_wkt())
    x, y = transformer.transform(lon, lat)
    return x, y


def is_valid_crs(crs: CRS | None) -> bool:
    if crs is None:
        return False
    try:
        return crs.is_projected or crs.is_geographic
    except Exception:  # noqa: BLE001
        return False

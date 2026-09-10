"""GeoTIFF inspection/extraction (rasterio)."""
from __future__ import annotations

import logging

import rasterio
from pyproj import CRS
from rasterio.warp import transform as warp_transform

from app.schemas.upload import FileValidationResult

logger = logging.getLogger("app.raster")


def inspect_geotiff(path: str, filename: str) -> tuple[FileValidationResult, dict]:
    errors: list[str] = []
    warnings: list[str] = []
    meta: dict = {}

    try:
        with rasterio.open(path) as src:
            meta["width"] = src.width
            meta["height"] = src.height
            meta["count"] = src.count
            meta["dtype"] = str(src.dtypes[0]) if src.dtypes else None
            meta["nodata"] = src.nodata
            meta["transform"] = list(src.transform)[:6]
            meta["descriptions"] = list(src.descriptions or [])

            crs = src.crs
            detected_crs = crs.to_string() if crs else None
            if crs is None:
                errors.append("Raster has no CRS defined.")
            elif not (crs.is_geographic or crs.is_projected):
                errors.append(f"Raster CRS could not be validated: {detected_crs}")

            bounds4326 = None
            if crs is not None:
                try:
                    b = src.bounds
                    xs, ys = warp_transform(crs, CRS.from_epsg(4326), [b.left, b.right], [b.bottom, b.top])
                    bounds4326 = [min(xs), min(ys), max(xs), max(ys)]
                except Exception as exc:  # noqa: BLE001
                    warnings.append(f"Could not reproject bounds to EPSG:4326: {exc}")

            if src.width <= 0 or src.height <= 0:
                errors.append("Raster has zero or negative dimensions.")
            if src.count < 1:
                errors.append("Raster has no bands.")

        result = FileValidationResult(
            filename=filename,
            file_type="geotiff",
            readable=not errors,
            detected_crs=detected_crs,
            bounds=bounds4326,
            errors=errors,
            warnings=warnings,
        )
        return result, meta
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to open GeoTIFF %s: %s", filename, exc)
        return (
            FileValidationResult(
                filename=filename,
                file_type="geotiff",
                readable=False,
                errors=[f"Could not open as GeoTIFF: {exc}"],
            ),
            {},
        )


def sample_point(path: str, latitude: float, longitude: float, band: int = 1) -> float | None:
    """Samples a raster at (latitude, longitude) in EPSG:4326, transforming
    into the raster's own CRS first. Returns None on NoData or out-of-bounds."""
    with rasterio.open(path) as src:
        if src.crs is None:
            raise ValueError("Raster has no CRS; cannot sample by geographic coordinate.")
        xs, ys = warp_transform(CRS.from_epsg(4326), src.crs, [longitude], [latitude])
        x, y = xs[0], ys[0]

        row, col = src.index(x, y)
        if row < 0 or row >= src.height or col < 0 or col >= src.width:
            return None

        value = next(src.sample([(x, y)], indexes=band))[0]
        if src.nodata is not None and value == src.nodata:
            return None
        if value != value:  # NaN
            return None
        return float(value)

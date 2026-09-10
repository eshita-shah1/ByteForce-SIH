"""Shared input-validation helpers."""
from __future__ import annotations

import math
import re

_SAFE_FILENAME_RE = re.compile(r"^[A-Za-z0-9_.\-]+$")


def validate_lat_lon(latitude: float, longitude: float) -> None:
    if math.isnan(latitude) or math.isnan(longitude):
        raise ValueError("Coordinates must be finite numbers.")
    if not (-90 <= latitude <= 90):
        raise ValueError(f"Latitude {latitude} out of range [-90, 90].")
    if not (-180 <= longitude <= 180):
        raise ValueError(f"Longitude {longitude} out of range [-180, 180].")


def sanitize_filename(filename: str) -> str:
    """Strips any directory component and rejects anything but a safe
    basename, to prevent path traversal via uploaded filenames."""
    base = filename.replace("\\", "/").rsplit("/", 1)[-1]
    if base in ("", ".", ".."):
        return "upload"
    if not _SAFE_FILENAME_RE.match(base):
        base = re.sub(r"[^A-Za-z0-9_.\-]", "_", base) or "upload"
    return base

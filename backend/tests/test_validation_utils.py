import pytest

from app.utils.validation import sanitize_filename, validate_lat_lon


def test_validate_lat_lon_accepts_valid():
    validate_lat_lon(21.84, 80.23)


@pytest.mark.parametrize("lat,lon", [(91, 0), (-91, 0), (0, 181), (0, -181), (float("nan"), 0)])
def test_validate_lat_lon_rejects_invalid(lat, lon):
    with pytest.raises(ValueError):
        validate_lat_lon(lat, lon)


def test_sanitize_filename_strips_path_traversal():
    assert sanitize_filename("../../etc/passwd") == "passwd"
    assert sanitize_filename("..\\..\\windows\\system32\\evil.tif") == "evil.tif"


def test_sanitize_filename_allows_normal_names():
    assert sanitize_filename("elevation_300m.tif") == "elevation_300m.tif"


def test_sanitize_filename_rejects_empty_or_dot():
    assert sanitize_filename("..") == "upload"
    assert sanitize_filename(".") == "upload"

"""GET /api/environment/{pit_id} - the Shortfall screen's "Live
Environmental Context" bar. Independent of the ML prediction flow
(POST /api/shortfall) - these tests only cover this endpoint's own
contract, not shortfall/risk/corrective-measure logic."""
import datetime as dt

import pytest


def test_unknown_pit_id_returns_404():
    pytest.importorskip("psycopg")
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    response = client.get("/api/environment/NOT_A_REAL_PIT")
    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False


def test_valid_pit_id_returns_environment_shape():
    """Requires network access to Open-Meteo; skips if unreachable rather
    than asserting a fake response."""
    pytest.importorskip("psycopg")
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    response = client.get("/api/environment/BAL_NORTH_PIT")
    if response.status_code != 200:
        pytest.skip(f"Open-Meteo unavailable in this environment: {response.status_code}")

    body = response.json()
    assert body["success"] is True
    assert body["pit_id"] == "BAL_NORTH_PIT"
    assert body["latitude"] == 21.87
    assert body["longitude"] == 80.2275
    for field in (
        "rainfall_intensity_mm",
        "cumulative_rainfall_72h",
        "soil_moisture_index",
        "temperature_celsius",
        "humidity_pct",
    ):
        assert isinstance(body[field], (int, float))
    assert body["surface_water_risk"] in (
        "Low surface water risk",
        "Moderate surface water risk",
        "High surface water risk",
    )
    assert body["source"] == "Open-Meteo"
    assert isinstance(body["observed_at"], str) and body["observed_at"]
    # Must carry an explicit UTC offset (e.g. "+05:30") - a bare
    # "2026-09-11T23:00:00" with no offset is exactly the ambiguous form
    # this fix removes.
    parsed = dt.datetime.fromisoformat(body["observed_at"])
    assert parsed.tzinfo is not None
    assert parsed.utcoffset() is not None


def test_classify_surface_water_risk_thresholds():
    """Unit-level check of the pure classification function (no network)."""
    from app.services.weather_service import classify_surface_water_risk

    assert classify_surface_water_risk(0.0, 0.0) == "Low surface water risk"
    assert classify_surface_water_risk(15.0, 0.0) == "Moderate surface water risk"
    assert classify_surface_water_risk(0.0, 25.0) == "Moderate surface water risk"
    assert classify_surface_water_risk(30.0, 0.0) == "High surface water risk"
    assert classify_surface_water_risk(0.0, 60.0) == "High surface water risk"


# --- _attach_utc_offset: the actual timezone-bug fix, isolated from any
# network call so it's fast, deterministic, and exercises exactly the
# ambiguous-naive-timestamp scenario that produced the bug report. ---

def test_attach_utc_offset_produces_the_exact_expected_ist_string():
    """The real-world case from the bug report: Open-Meteo's naive local
    time for a Balaghat/MP pit (Asia/Kolkata, UTC+5:30) must come back
    with an explicit "+05:30" offset, not bare."""
    from app.services.weather_service import _attach_utc_offset

    result = _attach_utc_offset("2026-09-11T23:00", 19800)  # 19800s = 5h30m
    assert result == "2026-09-11T23:00:00+05:30"


def test_attach_utc_offset_is_not_misinterpreted_as_utc():
    """Direct proof of the actual bug this fixes: a bare naive string is
    ambiguous and gets silently treated as UTC (or the caller's own
    timezone) by anything that doesn't know better. The fixed output must
    unambiguously represent the pit's local time - i.e. its real UTC
    instant must be 5h30m BEHIND the wall-clock digits, not equal to
    them."""
    from app.services.weather_service import _attach_utc_offset

    result = _attach_utc_offset("2026-09-11T23:00", 19800)
    parsed = dt.datetime.fromisoformat(result)

    # If this were (incorrectly) treated as UTC, its UTC instant would be
    # 23:00 UTC. The correct instant, given a +05:30 offset, is 17:30 UTC.
    utc_instant = parsed.astimezone(dt.timezone.utc)
    assert utc_instant == dt.datetime(2026, 9, 11, 17, 30, tzinfo=dt.timezone.utc)
    assert utc_instant != dt.datetime(2026, 9, 11, 23, 0, tzinfo=dt.timezone.utc)


def test_attach_utc_offset_preserves_wall_clock_digits_across_midnight():
    """Attaching an offset must never shift the date/time digits
    themselves (that would be a UTC *conversion*, which is not what this
    function does) - it only adds the missing offset tag. Using a
    late-night timestamp specifically to prove no accidental date-rollover
    happens at the attachment step."""
    from app.services.weather_service import _attach_utc_offset

    result = _attach_utc_offset("2026-09-11T23:45", 19800)
    assert result == "2026-09-11T23:45:00+05:30"
    assert result.startswith("2026-09-11T23:45")  # date/hour untouched


def test_attach_utc_offset_is_not_hardcoded_to_ist():
    """Must use whatever offset is actually passed in, not a fixed
    Asia/Kolkata assumption - proven with a different (negative,
    non-IST) offset."""
    from app.services.weather_service import _attach_utc_offset

    result = _attach_utc_offset("2026-09-11T23:00", -18000)  # UTC-5 (US Eastern, standard time)
    assert result == "2026-09-11T23:00:00-05:00"


def test_attach_utc_offset_falls_back_gracefully_when_offset_missing():
    """Defensive path: if Open-Meteo ever omits utc_offset_seconds, the
    function must not crash - it degrades to the naive string rather than
    fabricating an offset."""
    from app.services.weather_service import _attach_utc_offset

    assert _attach_utc_offset("2026-09-11T23:00", None) == "2026-09-11T23:00"

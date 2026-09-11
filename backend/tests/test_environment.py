"""GET /api/environment/{pit_id} - the Shortfall screen's "Live
Environmental Context" bar. Independent of the ML prediction flow
(POST /api/shortfall) - these tests only cover this endpoint's own
contract, not shortfall/risk/corrective-measure logic."""
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
    ):
        assert isinstance(body[field], (int, float))
    assert body["surface_water_risk"] in (
        "Low surface water risk",
        "Moderate surface water risk",
        "High surface water risk",
    )
    assert body["source"] == "Open-Meteo"
    assert isinstance(body["observed_at"], str) and body["observed_at"]


def test_classify_surface_water_risk_thresholds():
    """Unit-level check of the pure classification function (no network)."""
    from app.services.weather_service import classify_surface_water_risk

    assert classify_surface_water_risk(0.0, 0.0) == "Low surface water risk"
    assert classify_surface_water_risk(15.0, 0.0) == "Moderate surface water risk"
    assert classify_surface_water_risk(0.0, 25.0) == "Moderate surface water risk"
    assert classify_surface_water_risk(30.0, 0.0) == "High surface water risk"
    assert classify_surface_water_risk(0.0, 60.0) == "High surface water risk"

"""Requires a full environment (DB driver installed, per requirements.txt).
Run inside the project's real venv, not the throwaway inspection venv used
during development - see README's "Version compatibility" note."""
import pytest


def test_health_endpoint_returns_200():
    pytest.importorskip("psycopg")
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert "checks" in body

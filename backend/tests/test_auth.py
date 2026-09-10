"""Requires a full environment (DB driver installed, per requirements.txt).
Run inside the project's real venv, not the throwaway inspection venv used
during development - see README's "Version compatibility" note."""
import pytest


def _client(monkeypatch, admin_username="admin", admin_password="s3cret-pw"):
    pytest.importorskip("psycopg")
    from fastapi.testclient import TestClient

    monkeypatch.setenv("ADMIN_USERNAME", admin_username)
    monkeypatch.setenv("ADMIN_PASSWORD", admin_password)

    from app.core.config import get_settings

    get_settings.cache_clear()

    from app.main import app

    return TestClient(app)


def test_login_with_valid_credentials_returns_user(monkeypatch):
    client = _client(monkeypatch, admin_username="admin@terrascope.io", admin_password="s3cret-pw")

    response = client.post(
        "/api/auth/login",
        json={"email": "Admin@TerraScope.io", "password": "s3cret-pw"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["user"]["email"] == "admin@terrascope.io"
    assert body["user"]["role"] == "Administrator"
    assert body["user"]["id"]
    assert body["user"]["initials"]


def test_login_with_wrong_password_returns_401(monkeypatch):
    client = _client(monkeypatch)

    response = client.post(
        "/api/auth/login",
        json={"email": "admin", "password": "not-the-password"},
    )

    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "UNAUTHORIZED"


def test_login_with_unknown_email_returns_401(monkeypatch):
    client = _client(monkeypatch)

    response = client.post(
        "/api/auth/login",
        json={"email": "not-the-admin@example.com", "password": "s3cret-pw"},
    )

    assert response.status_code == 401


def test_login_without_admin_password_configured_returns_401(monkeypatch):
    client = _client(monkeypatch, admin_password="")

    response = client.post(
        "/api/auth/login",
        json={"email": "admin", "password": "anything"},
    )

    assert response.status_code == 401


def test_login_rejects_missing_fields(monkeypatch):
    client = _client(monkeypatch)

    response = client.post("/api/auth/login", json={"email": "admin"})

    assert response.status_code == 422

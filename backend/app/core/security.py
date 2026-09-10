"""Admin-only authentication. There are no end-user accounts in this system.

Uses HTTP Basic auth checked against credentials from environment variables,
with constant-time comparison. A missing ADMIN_PASSWORD disables the admin
panel entirely (fails closed, not open).
"""
from __future__ import annotations

import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from app.core.config import Settings, get_settings

security = HTTPBasic()


def require_admin(
    credentials: HTTPBasicCredentials = Depends(security),
    settings: Settings = Depends(get_settings),
) -> str:
    if not settings.admin_password:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin panel is not configured (ADMIN_PASSWORD not set).",
        )

    valid_username = secrets.compare_digest(credentials.username, settings.admin_username)
    valid_password = secrets.compare_digest(credentials.password, settings.admin_password)

    if not (valid_username and valid_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials.",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


def verify_login_credentials(email: str, password: str, settings: Settings) -> bool:
    """Same admin credential source as require_admin (RULE 16: no separate
    end-user accounts), but for the JSON login endpoint the frontend expects
    (POST /api/auth/login), which identifies the account by email rather
    than HTTP Basic's username. Compared case-insensitively since the
    frontend lower-cases the email before sending it.
    """
    if not settings.admin_password:
        return False

    valid_username = secrets.compare_digest(
        email.strip().lower(), settings.admin_username.strip().lower()
    )
    valid_password = secrets.compare_digest(password, settings.admin_password)
    return valid_username and valid_password

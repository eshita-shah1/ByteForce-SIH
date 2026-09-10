"""JSON login for the frontend (frontend/src/services/api.ts: api.login()).

There are no end-user accounts in this system (see app/core/security.py /
RULE 16 in app/api/admin.py) - this authenticates against the same single
admin credential (ADMIN_USERNAME / ADMIN_PASSWORD) as the HTTP Basic admin
panel, just over the JSON contract the frontend's login form already sends.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.core.exceptions import AuthError
from app.core.security import verify_login_credentials
from app.schemas.auth import AuthenticatedUser, LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, settings: Settings = Depends(get_settings)):
    if not verify_login_credentials(request.email, request.password, settings):
        raise AuthError("Invalid email or password.")

    # ADMIN_USERNAME is email-shaped (see app/core/config.py) - use the local
    # part only, so "admin@terrascope.local" displays as "Admin", not
    # "Admin@Terrascope Local".
    local_part = settings.admin_username.split("@", 1)[0]
    display_name = local_part.replace(".", " ").replace("_", " ").strip() or "Admin"
    name_parts = display_name.split()
    initials = (
        f"{name_parts[0][0]}{name_parts[-1][0]}".upper()
        if len(name_parts) > 1
        else display_name[:2].upper()
    )

    return LoginResponse(
        user=AuthenticatedUser(
            id="admin",
            name=display_name.title(),
            email=request.email.strip().lower(),
            initials=initials,
            role="Administrator",
        )
    )

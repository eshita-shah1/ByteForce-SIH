from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class AuthenticatedUser(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    email: str
    initials: str
    role: str
    avatar_url: str | None = Field(default=None, alias="avatarUrl")


class LoginResponse(BaseModel):
    success: bool = True
    user: AuthenticatedUser

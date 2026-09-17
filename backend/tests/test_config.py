"""Regression tests for Settings.database_url normalization.

Render's managed Postgres (and most providers) hands back a bare
`postgresql://` or `postgres://` connection string with no driver name.
SQLAlchemy's default driver for that scheme is psycopg2, which isn't
installed here (requirements.txt only pins psycopg[binary]==3.2.3, i.e.
psycopg v3) - an un-normalized URL crashes create_engine() at import time.
See app/core/config.py's Settings._ensure_psycopg3_driver."""
from app.core.config import Settings


def test_bare_postgresql_scheme_is_rewritten_to_psycopg3():
    settings = Settings(database_url="postgresql://user:pass@host:5432/db")
    assert settings.database_url == "postgresql+psycopg://user:pass@host:5432/db"


def test_bare_postgres_scheme_is_rewritten_to_psycopg3():
    """Some providers (e.g. Heroku-style) use the older `postgres://` scheme."""
    settings = Settings(database_url="postgres://user:pass@host:5432/db")
    assert settings.database_url == "postgresql+psycopg://user:pass@host:5432/db"


def test_url_with_explicit_driver_is_left_untouched():
    settings = Settings(database_url="postgresql+psycopg://user:pass@host:5432/db")
    assert settings.database_url == "postgresql+psycopg://user:pass@host:5432/db"


def test_url_with_a_different_explicit_driver_is_left_untouched():
    """Not this app's current setup, but the normalization must not clobber
    a deliberately-chosen different driver if one is ever configured."""
    settings = Settings(database_url="postgresql+asyncpg://user:pass@host:5432/db")
    assert settings.database_url == "postgresql+asyncpg://user:pass@host:5432/db"


def test_default_database_url_already_uses_psycopg3():
    settings = Settings()
    assert settings.database_url.startswith("postgresql+psycopg://")

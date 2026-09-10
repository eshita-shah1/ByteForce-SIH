"""SQLAlchemy engine / session management (PostgreSQL + PostGIS)."""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> tuple[bool, str | None]:
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
        return True, None
    except Exception as exc:  # noqa: BLE001 - health check, want the message
        return False, str(exc)


def check_postgis() -> tuple[bool, str | None]:
    try:
        with engine.connect() as conn:
            row = conn.exec_driver_sql("SELECT PostGIS_Version()").fetchone()
        return True, row[0] if row else None
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)

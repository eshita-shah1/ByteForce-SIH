from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.db.database import check_db_connection, check_postgis
from app.services.model1_service import model1_service
from app.services.model2_service import model2_service

router = APIRouter(tags=["health"])


@router.get("/api/health")
def health(settings: Settings = Depends(get_settings)):
    db_ok, db_error = check_db_connection()
    postgis_ok, postgis_version = check_postgis() if db_ok else (False, None)

    checks = {
        "backend": {"status": "up"},
        "database": {"status": "up" if db_ok else "down", "error": db_error},
        "postgis": {"status": "up" if postgis_ok else "down", "version": postgis_version},
        "model1": {"status": "loaded" if model1_service.is_loaded else "not_loaded"},
        "model2": {"status": "loaded" if model2_service.is_loaded else "not_loaded"},
        "external_weather_api": {"status": "configured", "provider": "open-meteo (no key required)"},
    }
    overall_ok = db_ok and postgis_ok and model1_service.is_loaded and model2_service.is_loaded
    return {"success": True, "status": "ok" if overall_ok else "degraded", "checks": checks}

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, auth, documents, environment, health, logs, prospectivity, shortfall, study_area, upload
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import RequestContextMiddleware, configure_logging
from app.services.model1_service import model1_service
from app.services.model2_service import model2_service

settings = get_settings()
configure_logging(debug=settings.debug)
logger = logging.getLogger("app.startup")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description=(
            "Backend for the Manganese Mining Intelligence System: an independent "
            "Model 1 (manganese prospectivity) and Model 2 (production shortfall) "
            "pipeline over PostGIS-backed spatial data, uploaded-GIS workflows, and "
            "live weather data."
        ),
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestContextMiddleware)

    register_exception_handlers(app)

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(logs.router)
    app.include_router(documents.router)
    app.include_router(study_area.router)
    app.include_router(prospectivity.router)
    app.include_router(upload.router)
    app.include_router(shortfall.router)
    app.include_router(environment.router)
    app.include_router(admin.router)

    @app.on_event("startup")
    def load_models() -> None:
        settings.upload_dir.mkdir(parents=True, exist_ok=True)
        model1_service.load(settings)
        model2_service.load(settings)
        if not model1_service.is_loaded:
            logger.error("Model 1 failed to load - prospectivity endpoints will return MODEL_NOT_LOADED.")
        if not model2_service.is_loaded:
            logger.error("Model 2 failed to load - shortfall endpoints will return MODEL_NOT_LOADED.")

    return app


app = create_app()

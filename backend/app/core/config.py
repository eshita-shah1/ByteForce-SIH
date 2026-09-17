"""Central application configuration, loaded from environment variables / .env."""
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODELS_DIR = BASE_DIR / "models"
DATA_DIR = BASE_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    app_name: str = "Manganese Mining Intelligence System"
    environment: str = Field(default="development")
    debug: bool = Field(default=False)

    # --- CORS ---
    cors_origins: str = Field(default="http://localhost:5173,http://localhost:3000")

    # --- Database ---
    database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/manganese_gis"
    )

    @field_validator("database_url")
    @classmethod
    def _ensure_psycopg3_driver(cls, v: str) -> str:
        """Render's managed Postgres (like most providers' connection
        strings) is a bare `postgresql://...` URL with no driver specified.
        SQLAlchemy's default driver for that scheme is psycopg2 - but
        requirements.txt only installs psycopg[binary]==3.2.3 (psycopg v3),
        not psycopg2/psycopg2-binary - so an un-normalized URL crashes
        create_engine() at import time with "ModuleNotFoundError: No module
        named 'psycopg2'" (confirmed 2026-09-18: this is exactly what broke
        the Render deploy). Rewrite bare postgres:// / postgresql:// URLs to
        explicitly select the psycopg (v3) driver; a URL that already names
        a driver (postgresql+psycopg://, postgresql+asyncpg://, etc.) is
        left untouched.
        """
        if v.startswith("postgres://"):
            return "postgresql+psycopg://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            return "postgresql+psycopg://" + v[len("postgresql://"):]
        return v

    # --- Model artifacts ---
    model1_dir: Path = MODELS_DIR
    model1_preprocessor_path: Path = MODELS_DIR / "preprocessor.pkl"
    model1_model_path: Path = MODELS_DIR / "xgboost_manganese_model.pkl"
    model1_config_path: Path = MODELS_DIR / "model_config.json"

    model2_pipeline_path: Path = MODELS_DIR / "MOIL_Module2_Final_Model.pkl"
    model2_pipeline_fallback_path: Path = MODELS_DIR / "moil_production_pipeline.pkl"

    study_boundary_geojson_path: Path = DATA_DIR / "study_boundary.geojson"

    # --- Spatial lookup ---
    # Same-cell match tolerance used by the original 300m-grid spatial joins
    # (300 * sqrt(2) / 2 = 212.13m), reused here so existing-study-area point
    # lookups are consistent with how the training/prediction grid was built.
    grid_cell_size_m: float = 300.0
    grid_match_tolerance_m: float = 212.13

    # --- Uploads ---
    upload_dir: Path = BASE_DIR / "uploads"
    max_upload_size_mb: int = 200
    upload_ttl_hours: int = 24

    # --- Admin auth ---
    # Email-shaped by default: the frontend's login form is <input type="email">,
    # so an ADMIN_USERNAME without an "@" fails client-side validation before
    # it ever reaches this backend. Override via env for real deployments.
    admin_username: str = Field(default="admin@terrascope.local")
    admin_password: str = Field(default="")  # must be set via env in real deployments
    admin_session_secret: str = Field(default="change-me-in-production")

    # --- External data (Module 2 live weather/soil inputs) ---
    external_api_timeout_seconds: float = 10.0
    open_meteo_base_url: str = "https://api.open-meteo.com/v1/forecast"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

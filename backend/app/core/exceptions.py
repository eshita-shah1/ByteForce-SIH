"""Centralized exception types and handlers producing a consistent error schema:

{
    "success": false,
    "error_code": "...",
    "message": "...",
    "details": "..."
}
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("app")


class AppError(Exception):
    """Base class for all domain errors the API intentionally raises."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    error_code: str = "APP_ERROR"

    def __init__(self, message: str, details: str | None = None, error_code: str | None = None):
        self.message = message
        self.details = details
        if error_code:
            self.error_code = error_code
        super().__init__(message)


class ValidationAppError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    error_code = "VALIDATION_ERROR"


class OutsideStudyAreaError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "OUTSIDE_STUDY_AREA"


class NoMatchingRecordError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "NO_MATCHING_RECORD"


class MissingRequiredFeatureError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    error_code = "MISSING_REQUIRED_FEATURE"


class DatasetValidationError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    error_code = "DATASET_VALIDATION_FAILED"


class UploadNotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "UPLOAD_NOT_FOUND"


class ModelNotLoadedError(AppError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    error_code = "MODEL_NOT_LOADED"


class ExternalApiError(AppError):
    status_code = status.HTTP_502_BAD_GATEWAY
    error_code = "EXTERNAL_API_UNAVAILABLE"


class InferenceError(AppError):
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    error_code = "INFERENCE_FAILED"


class AuthError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    error_code = "UNAUTHORIZED"


def _error_response(status_code: int, error_code: str, message: str, details: str | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error_code": error_code, "message": message, "details": details},
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError):
        logger.warning("app_error", extra={"error_code": exc.error_code, "path": request.url.path})
        return _error_response(exc.status_code, exc.error_code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError):
        logger.info("request_validation_error", extra={"path": request.url.path})
        return _error_response(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "VALIDATION_ERROR",
            "Request validation failed.",
            details=str(exc.errors()),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException):
        return _error_response(exc.status_code, "HTTP_ERROR", str(exc.detail))

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception):
        logger.exception("unhandled_exception", extra={"path": request.url.path})
        return _error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "An unexpected error occurred.",
            details=None,
        )

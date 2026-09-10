"""Persists and reads the model-execution audit trail (model_run_logs),
backing GET /api/logs."""
from __future__ import annotations

import logging
import uuid

from sqlalchemy.orm import Session

from app.db.models import ModelRunLog
from app.schemas.shortfall_report import ShortfallReportData

logger = logging.getLogger("app.logs")


def record_run(
    db: Session,
    *,
    model_type: str,
    title: str,
    target_site: str,
    metric_highlight: str,
    status: str = "Completed",
    report_ref: ShortfallReportData | None = None,
) -> None:
    """Best-effort audit write: a logging failure must never break the
    caller's actual prediction response, so errors are swallowed (and
    logged) rather than raised."""
    try:
        db.add(
            ModelRunLog(
                id=uuid.uuid4().hex,
                model_type=model_type,
                title=title,
                target_site=target_site,
                status=status,
                metric_highlight=metric_highlight,
                report_ref_json=report_ref.model_dump_json(by_alias=True) if report_ref else None,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to record model run log")


def list_runs(db: Session, limit: int = 200) -> list[ModelRunLog]:
    return (
        db.query(ModelRunLog)
        .order_by(ModelRunLog.created_at.desc())
        .limit(limit)
        .all()
    )

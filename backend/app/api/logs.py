"""GET /api/logs - the frontend's "Model Execution Logs" view
(frontend/src/views/LogsView.tsx expects a plain RunLog[] array).

Backed by model_run_logs, written by app/api/prospectivity.py and
app/api/shortfall.py right after each successful prediction."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.logs import RunLogResponse
from app.schemas.shortfall_report import ShortfallReportData
from app.services import log_service

logger = logging.getLogger("app.logs")

router = APIRouter(tags=["logs"])


def _parse_report_ref(run_id: str, report_ref_json: str | None) -> ShortfallReportData | None:
    """A log row's saved report_ref_json was written by whatever code
    version was live at the time - it can predate a schema change (e.g.
    today's additions of model_version/model_explanation) and fail to
    validate against the CURRENT ShortfallReportData shape. One
    unparseable historical row must not take down the entire logs list -
    that row's report is simply omitted (still shown with everything
    else it has), and the failure is logged server-side, never silently
    hidden and never allowed to 500 the whole endpoint."""
    if not report_ref_json:
        return None
    try:
        return ShortfallReportData.model_validate_json(report_ref_json)
    except ValidationError:
        logger.warning("Log run %s has a report_ref_json that no longer matches the current schema; omitting it.", run_id)
        return None


@router.get("/api/logs", response_model=list[RunLogResponse])
def get_logs(db: Session = Depends(get_db)):
    runs = log_service.list_runs(db)
    return [
        RunLogResponse(
            id=run.id,
            model_type=run.model_type,
            title=run.title,
            target_site=run.target_site,
            timestamp=run.created_at.isoformat() if run.created_at else "",
            status=run.status,
            metric_highlight=run.metric_highlight,
            report_ref=_parse_report_ref(run.id, run.report_ref_json),
        )
        for run in runs
    ]

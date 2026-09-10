"""GET /api/logs - the frontend's "Model Execution Logs" view
(frontend/src/views/LogsView.tsx expects a plain RunLog[] array).

Backed by model_run_logs, written by app/api/prospectivity.py and
app/api/shortfall.py right after each successful prediction."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.logs import RunLogResponse
from app.schemas.shortfall_report import ShortfallReportData
from app.services import log_service

router = APIRouter(tags=["logs"])


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
            report_ref=ShortfallReportData.model_validate_json(run.report_ref_json) if run.report_ref_json else None,
        )
        for run in runs
    ]

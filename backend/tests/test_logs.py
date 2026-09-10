"""Requires a full environment (DB driver + a reachable Postgres with the
model_run_logs table already created - see scripts/init_db.py). Run inside
the project's real venv/docker-compose, not the throwaway inspection venv -
see README's "Version compatibility" note."""
import uuid

import pytest


def _client_and_db():
    pytest.importorskip("psycopg")
    from fastapi.testclient import TestClient

    from app.db.database import SessionLocal
    from app.main import app

    return TestClient(app), SessionLocal()


def test_logs_endpoint_returns_array_shaped_for_frontend():
    client, db = _client_and_db()
    from app.services import log_service

    marker = uuid.uuid4().hex[:8]
    try:
        log_service.record_run(
            db,
            model_type="Prospectivity",
            title=f"test scan {marker}",
            target_site="CELL_TEST",
            metric_highlight="87% · manganese present",
        )

        response = client.get("/api/logs")
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)

        match = next(item for item in body if item["title"] == f"test scan {marker}")
        assert match["modelType"] == "Prospectivity"
        assert match["targetSite"] == "CELL_TEST"
        assert match["status"] == "Completed"
        assert match["metricHighlight"] == "87% · manganese present"
        assert match["timestamp"]
        assert match["id"]
    finally:
        from app.db.models import ModelRunLog

        db.query(ModelRunLog).filter(ModelRunLog.title == f"test scan {marker}").delete()
        db.commit()
        db.close()


def test_logs_are_returned_most_recent_first():
    client, db = _client_and_db()
    from app.services import log_service

    marker = uuid.uuid4().hex[:8]
    try:
        log_service.record_run(
            db,
            model_type="Shortfall",
            title=f"older {marker}",
            target_site="PIT_A",
            metric_highlight="5.0% shortfall · Normal",
        )
        log_service.record_run(
            db,
            model_type="Shortfall",
            title=f"newer {marker}",
            target_site="PIT_A",
            metric_highlight="12.0% shortfall · Alert",
            status="Flagged",
        )

        body = client.get("/api/logs").json()
        titles = [item["title"] for item in body if marker in item["title"]]
        assert titles == [f"newer {marker}", f"older {marker}"]
    finally:
        from app.db.models import ModelRunLog

        db.query(ModelRunLog).filter(ModelRunLog.target_site == "PIT_A", ModelRunLog.title.contains(marker)).delete()
        db.commit()
        db.close()

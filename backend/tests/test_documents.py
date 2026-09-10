"""Requires a full environment (DB driver + a reachable Postgres with the
uploads/upload_files tables already created - see scripts/init_db.py)."""
import uuid

import pytest


def _client_and_db():
    pytest.importorskip("psycopg")
    from fastapi.testclient import TestClient

    from app.db.database import SessionLocal
    from app.main import app

    return TestClient(app), SessionLocal()


def test_documents_endpoint_returns_array_shaped_for_frontend():
    client, db = _client_and_db()
    from app.db.models import Upload, UploadFile

    upload_id = uuid.uuid4().hex
    try:
        db.add(Upload(id=upload_id, status="validated"))
        db.add(
            UploadFile(
                upload_id=upload_id,
                original_filename="drill_assays.csv",
                stored_path="/tmp/drill_assays.csv",
                file_type="csv",
                size_bytes=1_500_000,
                category="Legacy Core Assay Logs",
            )
        )
        db.commit()

        response = client.get("/api/documents")
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)

        match = next(item for item in body if item["name"] == "drill_assays.csv")
        assert match["format"] == "csv"
        assert match["category"] == "Legacy Core Assay Logs"
        assert match["status"] == "ready"
        assert match["size"] == "1.4 MB"
        assert match["id"]
        assert match["uploadedAt"]
    finally:
        from app.db.models import Upload, UploadFile

        db.query(UploadFile).filter(UploadFile.upload_id == upload_id).delete()
        db.query(Upload).filter(Upload.id == upload_id).delete()
        db.commit()
        db.close()


def test_documents_endpoint_omits_shapefile_companion_files():
    client, db = _client_and_db()
    from app.db.models import Upload, UploadFile

    upload_id = uuid.uuid4().hex
    try:
        db.add(Upload(id=upload_id, status="validated"))
        db.add(
            UploadFile(
                upload_id=upload_id,
                original_filename="boundary.dbf",
                stored_path="/tmp/boundary.dbf",
                file_type="companion",
                size_bytes=100,
            )
        )
        db.commit()

        body = client.get("/api/documents").json()
        assert not any(item["name"] == "boundary.dbf" for item in body)
    finally:
        from app.db.models import Upload, UploadFile

        db.query(UploadFile).filter(UploadFile.upload_id == upload_id).delete()
        db.query(Upload).filter(Upload.id == upload_id).delete()
        db.commit()
        db.close()

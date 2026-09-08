"""Initializes the database from scratch: enables PostGIS and creates all
tables defined in app.db.models.

Usage:
    python scripts/init_db.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.database import engine  # noqa: E402
from app.db.models import metadata  # noqa: E402


def main() -> None:
    settings = get_settings()
    print(f"Connecting to: {settings.database_url.split('@')[-1]}")

    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        print("PostGIS extension ensured.")

    metadata.create_all(engine)
    print("Tables created:")
    for table_name in metadata.tables:
        print(f"  - {table_name}")

    print("\nDatabase initialization complete.")
    print("Next: python scripts/import_prospectivity_data.py")


if __name__ == "__main__":
    main()

"""PostgreSQL migration and schema checks (isolated jcms_test only)."""

import os

import pytest
from sqlalchemy import create_engine, inspect, text

POSTGRES_TEST_URL = os.environ.get(
    "JCMS_POSTGRES_TEST_URL",
    "postgresql+psycopg://jcms:jcms@localhost:5433/jcms_test",
)


@pytest.fixture(scope="module")
def pg_engine():
    engine = create_engine(POSTGRES_TEST_URL, pool_pre_ping=True)
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    yield engine
    engine.dispose()


def test_postgres_connectivity(pg_engine):
    with pg_engine.connect() as conn:
        version = conn.execute(text("SELECT version()")).scalar()
        assert "PostgreSQL" in version


def test_expected_tables_exist(pg_engine):
    insp = inspect(pg_engine)
    tables = set(insp.get_table_names())
    required = {
        "users",
        "organizations",
        "jobs",
        "applications",
        "interviews",
        "offers",
        "placements",
        "files",
        "notifications",
        "audit_events",
        "placement_evidence",
        "interview_reschedule_requests",
    }
    missing = required - tables
    assert not missing, f"Missing tables: {missing}"


def test_json_columns_on_postgres(pg_engine):
    insp = inspect(pg_engine)
    cols = {c["name"]: c for c in insp.get_columns("student_profiles")}
    assert "skills" in cols or "projects" in cols

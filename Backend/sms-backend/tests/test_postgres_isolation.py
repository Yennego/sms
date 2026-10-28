"""Database-level school isolation on PostgreSQL: row level security and composite keys.

Skipped unless both URLs are set (the CI "postgres-isolation" job sets them):
- TEST_PG_ADMIN_URL: owner connection to a database at the migration head;
- TEST_PG_APP_URL: the same database as an ordinary role (no superuser, no BYPASSRLS),
  like production's API connection (scripts/create_app_db_role.sql).
"""
import os
import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import sessionmaker

from src.db.session import bind_session_to_tenant

ADMIN_URL = os.getenv("TEST_PG_ADMIN_URL")
APP_URL = os.getenv("TEST_PG_APP_URL")

if os.getenv("CI_REQUIRE_POSTGRES") and not (ADMIN_URL and APP_URL):
    raise RuntimeError("CI_REQUIRE_POSTGRES is set but TEST_PG_ADMIN_URL / TEST_PG_APP_URL are missing")
pytestmark = pytest.mark.skipif(not (ADMIN_URL and APP_URL), reason="PostgreSQL isolation URLs not set")


@pytest.fixture(scope="module")
def schools():
    admin = create_engine(ADMIN_URL)
    a, b = uuid.uuid4(), uuid.uuid4()
    grades = {a: uuid.uuid4(), b: uuid.uuid4()}
    with admin.begin() as c:
        for tenant, code in ((a, "ISOA"), (b, "ISOB")):
            c.execute(text("""INSERT INTO tenants (id, name, code, domain, is_active, created_at, updated_at)
                              VALUES (:id, :name, :code, :domain, true, now(), now())"""),
                      {"id": tenant, "name": f"School {code}", "code": code, "domain": code.lower()})
            c.execute(text("""INSERT INTO academic_grades (id, tenant_id, name, sequence, is_active, created_at, updated_at)
                              VALUES (:id, :t, 'Grade 1', 1, true, now(), now())"""),
                      {"id": grades[tenant], "t": tenant})
            c.execute(text("""INSERT INTO sections (id, tenant_id, name, grade_id, capacity, is_active, created_at, updated_at)
                              VALUES (gen_random_uuid(), :t, 'A', :g, 30, true, now(), now())"""),
                      {"t": tenant, "g": grades[tenant]})
    yield a, b, grades
    with admin.begin() as c:
        for tenant in (a, b):
            c.execute(text("DELETE FROM sections WHERE tenant_id = :t"), {"t": tenant})
            c.execute(text("DELETE FROM academic_grades WHERE tenant_id = :t"), {"t": tenant})
            c.execute(text("DELETE FROM tenants WHERE id = :t"), {"t": tenant})
    admin.dispose()


@pytest.fixture(scope="module")
def AppSession():
    engine = create_engine(APP_URL)
    yield sessionmaker(bind=engine)
    engine.dispose()


def _sections(db, tenant):
    return db.execute(text("SELECT count(*) FROM sections WHERE tenant_id = :t"), {"t": tenant}).scalar()


def test_app_role_is_subject_to_row_level_security(AppSession):
    db = AppSession()
    try:
        row = db.execute(text(
            "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
        )).first()
        assert tuple(row) == (False, False)
    finally:
        db.close()


def test_a_school_sees_only_its_own_rows(schools, AppSession):
    a, b, _ = schools
    db = AppSession()
    try:
        bind_session_to_tenant(db, a)
        assert _sections(db, a) == 1
        assert _sections(db, b) == 0  # even when the query asks for school B by id
    finally:
        db.close()


def test_no_school_bound_sees_nothing_and_platform_sees_all(schools, AppSession):
    a, b, _ = schools
    db = AppSession()
    try:
        assert _sections(db, a) == 0
    finally:
        db.close()
    db = AppSession()
    try:
        bind_session_to_tenant(db, None, bypass=True)
        assert _sections(db, a) == 1 and _sections(db, b) == 1
    finally:
        db.close()


def test_a_school_cannot_write_another_schools_rows(schools, AppSession):
    a, b, grades = schools
    db = AppSession()
    try:
        bind_session_to_tenant(db, a)
        with pytest.raises(DBAPIError, match="row-level security"):
            db.execute(text("""INSERT INTO sections (id, tenant_id, name, grade_id, capacity, is_active, created_at, updated_at)
                               VALUES (gen_random_uuid(), :t, 'X', :g, 30, true, now(), now())"""),
                       {"t": b, "g": grades[b]})
    finally:
        db.rollback()
        db.close()


def test_composite_keys_reject_links_between_schools(schools, AppSession):
    a, b, grades = schools
    db = AppSession()
    try:
        bind_session_to_tenant(db, None, bypass=True)  # even platform code can't cross-link
        with pytest.raises(DBAPIError, match="fk_tn_sections_grade_id"):
            db.execute(text("""INSERT INTO sections (id, tenant_id, name, grade_id, capacity, is_active, created_at, updated_at)
                               VALUES (gen_random_uuid(), :t, 'X', :g, 30, true, now(), now())"""),
                       {"t": a, "g": grades[b]})
    finally:
        db.rollback()
        db.close()

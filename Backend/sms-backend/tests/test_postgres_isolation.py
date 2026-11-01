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


FINANCE_TABLES = ("fee_schedules", "installment_plans", "student_fee_accounts", "invoices", "invoice_lines",
                  "fee_adjustments", "payments", "payment_allocations", "receipt_counters", "finance_settings")


def test_fee_tables_have_row_level_security_and_composite_keys():
    admin = create_engine(ADMIN_URL)
    try:
        with admin.connect() as c:
            rows = c.execute(text("""
                SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = ANY(:t)
            """), {"t": list(FINANCE_TABLES)}).all()
            assert {r[0] for r in rows} == set(FINANCE_TABLES)
            assert all(r[1] and r[2] for r in rows)
            policies = c.execute(text("SELECT count(*) FROM pg_policies WHERE policyname = 'tenant_isolation' "
                                      "AND tablename = ANY(:t)"), {"t": list(FINANCE_TABLES)}).scalar()
            assert policies == len(FINANCE_TABLES)
            keys = {r[0] for r in c.execute(text("SELECT conname FROM pg_constraint WHERE conname LIKE 'fk_tn_%'"))}
            assert {"fk_tn_payments_account_id", "fk_tn_payment_allocations_invoice_id",
                    "fk_tn_student_fee_accounts_student_id", "fk_tn_parent_student_student_id"} <= keys
    finally:
        admin.dispose()


COMMUNICATION_TABLES = ("notifications", "notification_deliveries", "notification_preferences", "announcements",
                        "files")


def test_communication_tables_have_row_level_security_and_composite_keys():
    admin = create_engine(ADMIN_URL)
    try:
        with admin.connect() as c:
            rows = c.execute(text("""
                SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = ANY(:t)
            """), {"t": list(COMMUNICATION_TABLES)}).all()
            assert {r[0] for r in rows} == set(COMMUNICATION_TABLES)
            assert all(r[1] and r[2] for r in rows)
            policies = c.execute(text("SELECT count(*) FROM pg_policies WHERE policyname = 'tenant_isolation' "
                                      "AND tablename = ANY(:t)"), {"t": list(COMMUNICATION_TABLES)}).scalar()
            assert policies == len(COMMUNICATION_TABLES)
            keys = {r[0] for r in c.execute(text("SELECT conname FROM pg_constraint WHERE conname LIKE 'fk_tn_%'"))}
            assert {"fk_tn_notifications_user_id", "fk_tn_notification_deliveries_notification_id",
                    "fk_tn_notification_preferences_user_id", "fk_tn_announcements_class_id",
                    "fk_tn_announcements_student_id", "fk_tn_attendance_documents_file_id"} <= keys
    finally:
        admin.dispose()


def test_a_school_cannot_read_or_write_another_schools_notifications(schools, AppSession):
    a, b, _ = schools
    admin = create_engine(ADMIN_URL)
    user = uuid.uuid4()
    try:
        with admin.begin() as c:
            c.execute(text("""INSERT INTO users (id, tenant_id, username, password_hash, first_name, last_name, is_active,
                                                 is_first_login, type)
                              VALUES (:id, :t, :u, 'x', 'Iso', 'User', true, false, 'user')"""),
                      {"id": user, "t": b, "u": f"iso-{user.hex[:8]}"})
            c.execute(text("""INSERT INTO notifications (id, tenant_id, user_id, event, title, body, source_key)
                              VALUES (gen_random_uuid(), :t, :u, 'announcement', 'Hello', 'Body', 'iso')"""),
                      {"t": b, "u": user})
        db = AppSession()
        try:
            bind_session_to_tenant(db, a)
            assert db.execute(text("SELECT count(*) FROM notifications WHERE user_id = :u"), {"u": user}).scalar() == 0
            with pytest.raises(DBAPIError, match="row-level security"):
                db.execute(text("""INSERT INTO notifications (id, tenant_id, user_id, event, title, body, source_key)
                                   VALUES (gen_random_uuid(), :t, :u, 'announcement', 'X', 'X', 'iso2')"""),
                           {"t": b, "u": user})
        finally:
            db.rollback()
            db.close()
    finally:
        with admin.begin() as c:
            c.execute(text("DELETE FROM notifications WHERE user_id = :u"), {"u": user})
            c.execute(text("DELETE FROM users WHERE id = :u"), {"u": user})
        admin.dispose()


BILLING_PLATFORM_TABLES = ("platform_prices", "platform_counters", "school_subscriptions", "platform_invoices",
                           "platform_invoice_lines", "platform_payments", "platform_reminders")


def test_billing_tables_activity_months_isolated_platform_tables_not():
    """user_activity_months is written at sign-in bound to the school: row level security and a composite
    key to users. The billing tables are the platform's (school endpoints filter by school)."""
    admin = create_engine(ADMIN_URL)
    try:
        with admin.connect() as c:
            rows = dict(c.execute(text("SELECT relname, relrowsecurity AND relforcerowsecurity FROM pg_class "
                                       "WHERE relname = ANY(:t)"),
                                  {"t": ["user_activity_months", *BILLING_PLATFORM_TABLES]}).all())
            assert rows.pop("user_activity_months") is True
            assert rows == {t: False for t in BILLING_PLATFORM_TABLES}
            assert c.execute(text("SELECT count(*) FROM pg_policies WHERE policyname = 'tenant_isolation' "
                                  "AND tablename = 'user_activity_months'")).scalar() == 1
            keys = {r[0] for r in c.execute(text("SELECT conname FROM pg_constraint WHERE conname LIKE 'fk_tn_%'"))}
            assert {"fk_tn_user_activity_months_user_id", "fk_tn_platform_invoices_semester_id"} <= keys
    finally:
        admin.dispose()


def test_a_school_records_only_its_own_activity_months(schools, AppSession):
    a, b, _ = schools
    admin = create_engine(ADMIN_URL)
    users = {a: uuid.uuid4(), b: uuid.uuid4()}
    try:
        with admin.begin() as c:
            for tenant, user in users.items():
                c.execute(text("""INSERT INTO users (id, tenant_id, username, password_hash, first_name, last_name,
                                                     is_active, is_first_login, type)
                                  VALUES (:id, :t, :u, 'x', 'Iso', 'User', true, false, 'user')"""),
                          {"id": user, "t": tenant, "u": f"iso-{user.hex[:8]}"})
        db = AppSession()
        try:
            bind_session_to_tenant(db, a)
            insert = text("INSERT INTO user_activity_months (tenant_id, user_id, month) VALUES (:t, :u, '2026-11-01') "
                          "ON CONFLICT DO NOTHING")
            db.execute(insert, {"t": a, "u": users[a]})
            db.execute(insert, {"t": a, "u": users[a]})  # once per month
            assert db.execute(text("SELECT count(*) FROM user_activity_months")).scalar() == 1
            with pytest.raises(DBAPIError, match="row-level security"):
                db.execute(insert, {"t": b, "u": users[b]})
        finally:
            db.rollback()
            db.close()
    finally:
        with admin.begin() as c:
            c.execute(text("DELETE FROM user_activity_months WHERE user_id = ANY(:u)"), {"u": list(users.values())})
            c.execute(text("DELETE FROM users WHERE id = ANY(:u)"), {"u": list(users.values())})
        admin.dispose()

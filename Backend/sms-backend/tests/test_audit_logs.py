"""Audit-log visibility: schools see only their own data changes, never super-admin activity."""
from types import SimpleNamespace
from uuid import uuid4

from attendance_fixtures import db, make_user, run, school  # noqa: F401  (pytest fixtures)
from src.core.middleware.audit_middleware import AuditLoggingMiddleware, redact
from src.db.models.auth.admin import Admin
from src.db.models.auth.user_role import UserRole
from src.db.models.logging.activity_log import ActivityLog
from src.db.models.logging.super_admin_activity_log import SuperAdminActivityLog
from src.db.models.tenant.tenant import Tenant
from src.services.logging.activity_log_service import AuditLoggingService
from src.services.logging.super_admin_activity_log_service import SuperAdminActivityLogService


def fake_request(method, path, query=None, headers=None):
    return SimpleNamespace(
        method=method,
        url=SimpleNamespace(path=path, query=""),
        query_params=query or {},
        headers=headers or {},
    )


# --- What gets recorded ----------------------------------------------------------------------

def test_only_data_changes_are_recorded():
    mw = AuditLoggingMiddleware(app=None)
    assert mw.should_log_request(fake_request("POST", "/api/v1/people/students"))
    assert mw.should_log_request(fake_request("DELETE", "/api/v1/academics/classes/x"))
    assert not mw.should_log_request(fake_request("GET", "/api/v1/people/students"))
    assert not mw.should_log_request(fake_request("GET", "/api/v1/finance/fees/student-fees/export/xlsx"))
    for session_path in ("/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/logout"):
        assert not mw.should_log_request(fake_request("POST", session_path))
    # User management under /auth is still a data change
    assert mw.should_log_request(fake_request("POST", "/api/v1/auth/users/abc/roles"))
    assert mw.determine_action_and_entity(fake_request("POST", "/api/v1/auth/change-password")) == ("update", "user")


def test_secrets_are_redacted():
    body = {"email": "a@b.c", "new_password": "p", "nested": [{"access_token": "t", "name": "n"}]}
    assert redact(body) == {"email": "a@b.c", "new_password": "[REDACTED]",
                            "nested": [{"access_token": "[REDACTED]", "name": "n"}]}


def test_super_admin_target_school():
    mw = AuditLoggingMiddleware(app=None)
    home, target = uuid4(), uuid4()
    # Header / query name the school acted on
    assert mw.target_tenant_of(fake_request("PUT", "/api/v1/people/students/x", headers={"X-Tenant-ID": str(target)}), home) == target
    assert mw.target_tenant_of(fake_request("PUT", "/api/v1/super-admin/tenants/x", query={"tenant_id": str(target)}), home) == target
    # On /super-admin/ routes the account's home school is not a target
    assert mw.target_tenant_of(fake_request("POST", "/api/v1/super-admin/tenants"), home) is None
    assert mw.target_tenant_of(fake_request("POST", "/api/v1/academics/classes"), home) == home


# --- What each side can see ------------------------------------------------------------------

def test_school_sees_only_its_own_key_events(school, db):
    t = school["admin"].tenant_id
    other_school = Tenant(name="Other", code="OTH", domain="other")
    db.add(other_school)
    db.flush()
    sa_role = UserRole(name="super-admin")
    super_admin = make_user(Admin, t, sa_role)  # super-admin whose account lives in this school
    db.add(super_admin)
    db.flush()
    admin = school["admin"]

    def log(user, action, entity, tenant_id=t):
        db.add(ActivityLog(tenant_id=tenant_id, user_id=user.id if user else None, action=action, entity_type=entity))

    log(admin, "create", "student")
    log(admin, "update", "class")
    log(admin, "delete", "subject")
    log(None, "update", "system")            # system event: visible
    log(admin, "view", "system")             # read: hidden
    log(admin, "create", "auth")             # legacy login row: hidden
    log(super_admin, "update", "tenant")     # super-admin: hidden
    log(admin, "create", "student", other_school.id)  # other school: hidden
    db.add(SuperAdminActivityLog(user_id=super_admin.id, action="update", entity_type="tenant", target_tenant_id=t))
    db.add(SuperAdminActivityLog(user_id=super_admin.id, action="view", entity_type="tenant"))
    db.commit()

    svc = AuditLoggingService(db=db, tenant_id=t)
    items, total = run(svc.list_with_count(skip=0, limit=50))
    assert total == 4
    assert sorted((i.action, i.entity_type) for i in items) == [
        ("create", "student"), ("delete", "subject"), ("update", "class"), ("update", "system")]
    assert run(svc.get_by_entity("tenant", None)) == []

    sa = SuperAdminActivityLogService(db=db)
    assert sa.get_count() == 1
    assert [(l.action, l.target_tenant_id) for l in sa.get_all_logs()] == [("update", t)]
    assert sa.get_count(target_tenant_id=other_school.id) == 0

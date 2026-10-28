"""End-to-end security tests: authentication by default and tenant isolation.

Runs the real FastAPI app against in-memory SQLite with two schools (A and B).
Every request goes through the same middleware and dependencies as production.
"""
from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import attendance_fixtures  # noqa: F401  registers models and the SQLite JSONB shim
import main
from src.core.middleware import audit_middleware, tenant as tenant_middleware
from src.core.security.auth import PUBLIC_ROUTES
from src.core.security.jwt import create_access_token, create_refresh_token
from src.db.models.auth.admin import Admin
from src.db.models.auth.permission import Permission
from src.db.models.auth.user_role import UserRole
from src.db.models.base import Base
from src.db.models.people.student import Student
from src.db.models.tenant.tenant import Tenant
from src.db.session import get_db, request_session

ADMIN_PERMISSIONS = [
    "view_users", "manage_users", "delete_users", "view_students", "manage_students",
    "manage_teachers", "manage_tenant_settings", "view_financial_data", "manage_financial_data",
    "manage_roles",
]
PLATFORM_ONLY = ["manage_tenants"]


@pytest.fixture
def env(monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    def override_get_db():
        yield from request_session(Session)  # same commit/rollback as production

    # Middlewares open sessions directly (not through DI): point them at the test DB too
    monkeypatch.setattr(tenant_middleware, "get_db", override_get_db)
    monkeypatch.setattr(audit_middleware, "get_db", override_get_db)
    monkeypatch.setattr(audit_middleware, "get_super_admin_db", override_get_db)
    tenant_middleware.TENANT_CACHE.clear()
    main.app.dependency_overrides[get_db] = override_get_db

    db = Session()
    perms = {name: Permission(name=name) for name in ADMIN_PERMISSIONS + PLATFORM_ONLY}
    admin_role = UserRole(name="admin")
    admin_role.permissions = [perms[name] for name in ADMIN_PERMISSIONS]
    student_role = UserRole(name="student")
    sa_role = UserRole(name="super-admin")
    a = Tenant(name="School A", code="SCA", domain="school-a")
    b = Tenant(name="School B", code="SCB", domain="school-b")
    db.add_all([admin_role, student_role, sa_role, a, b, *perms.values()])
    db.flush()

    def make(cls, tenant, role, **extra):
        n = uuid4().hex[:8]
        extra.setdefault("is_first_login", False)
        user = cls(tenant_id=tenant.id, email=f"{n}@{tenant.domain}.org", password_hash="x",
                   first_name="F" + n, last_name="L", **extra)
        user.roles.append(role)
        db.add(user)
        return user

    users = {
        "admin_a": make(Admin, a, admin_role),
        "admin_b": make(Admin, b, admin_role),
        "student_a": make(Student, a, student_role, admission_number="A1"),
        "student_b": make(Student, b, student_role, admission_number="B1"),
        "super": make(Admin, a, sa_role),  # super-admin whose account lives in school A
        "new_admin_a": make(Admin, a, admin_role, is_first_login=True),  # still on an issued password
    }
    db.commit()
    ids = {k: v.id for k, v in users.items()}
    ids.update(tenant_a=a.id, tenant_b=b.id)
    db.close()

    client = TestClient(main.app)  # unexpected server errors fail the test with their traceback
    yield client, ids
    main.app.dependency_overrides.clear()
    engine.dispose()


def headers(ids, who, school=None, token_type="access"):
    tenant_key = {"admin_b": "tenant_b", "student_b": "tenant_b"}.get(who, "tenant_a")
    maker = create_access_token if token_type == "access" else create_refresh_token
    kwargs = {"expires_delta": timedelta(minutes=5)} if token_type == "access" else {}
    token = maker(ids[who], ids[tenant_key], is_super_admin=(who == "super"), **kwargs)
    return {"Authorization": f"Bearer {token}", "X-Tenant-ID": str(ids[school or tenant_key])}


def _concrete(path: str) -> str:
    return path.replace("{", "").replace("}", "")  # any value: auth must fail before it matters


# --- Authenticated by default -----------------------------------------------------------------

def test_every_non_public_route_requires_a_token(env):
    client, ids = env
    checked = 0
    for route in main.app.routes:
        if not isinstance(route, APIRoute):
            continue
        for method in route.methods - {"HEAD", "OPTIONS"}:
            if (method, route.path) in PUBLIC_ROUTES:
                continue
            resp = client.request(method, _concrete(route.path), headers={"X-Tenant-ID": str(ids["tenant_a"])})
            assert resp.status_code == 401, f"{method} {route.path} -> {resp.status_code}"
            checked += 1
    assert checked > 300


def test_refresh_token_is_not_an_access_token(env):
    client, ids = env
    assert client.get("/api/v1/auth/me", headers=headers(ids, "admin_a")).status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers(ids, "admin_a", token_type="refresh")).status_code == 401


def test_anonymous_cannot_delete_or_create_schools_or_teachers(env):
    client, ids = env
    anon = {"X-Tenant-ID": str(ids["tenant_b"])}  # an attacker names the target school
    assert client.delete(f"/api/v1/tenants/{ids['tenant_b']}", headers=anon).status_code == 401
    assert client.post("/api/v1/tenants/", json={"name": "Evil", "code": "EVL"}, headers=anon).status_code == 401
    assert client.post("/api/v1/people/teachers", json={}, headers=anon).status_code == 401
    # A school admin can't delete schools either
    assert client.delete(f"/api/v1/tenants/{ids['tenant_b']}", headers=headers(ids, "admin_a")).status_code == 403


def test_public_school_lookup_exposes_branding_only(env):
    client, ids = env
    resp = client.get(f"/api/v1/tenants/{ids['tenant_a']}")
    assert resp.status_code == 200
    assert "plan_amount" not in resp.json() and resp.json()["code"] == "SCA"
    assert client.get("/api/v1/tenants/", params={"domain": "school-b"}).json()[0]["code"] == "SCB"


# --- Tenant isolation ----------------------------------------------------------------------------

def test_header_cannot_switch_school(env):
    client, ids = env
    own = client.get("/api/v1/auth/users", headers=headers(ids, "admin_a"))
    assert own.status_code == 200
    emails = {u["id"] for u in own.json()}
    assert str(ids["admin_a"]) in emails and str(ids["admin_b"]) not in emails
    assert str(ids["super"]) not in emails  # super-admins are invisible to schools

    other = client.get("/api/v1/auth/users", headers=headers(ids, "admin_a", school="tenant_b"))
    assert other.status_code == 403


def test_super_admin_acts_on_the_school_in_the_header(env):
    client, ids = env
    resp = client.get("/api/v1/auth/users", headers=headers(ids, "super", school="tenant_b"))
    assert resp.status_code == 200
    assert str(ids["admin_b"]) in {u["id"] for u in resp.json()}


def test_cannot_touch_another_schools_user_by_id(env):
    client, ids = env
    h = headers(ids, "admin_a")
    assert client.get(f"/api/v1/auth/users/{ids['admin_b']}", headers=h).status_code == 404
    assert client.put(f"/api/v1/auth/users/{ids['admin_b']}", json={"first_name": "X"}, headers=h).status_code == 404
    assert client.delete(f"/api/v1/auth/users/{ids['admin_b']}", headers=h).status_code == 404
    assert client.post(f"/api/v1/auth/admin/reset-password/{ids['admin_b']}", headers=h).status_code == 404


def test_settings_path_must_be_own_school(env):
    client, ids = env
    h = headers(ids, "admin_a")
    assert client.get(f"/api/v1/tenants/{ids['tenant_b']}/settings", headers=h).status_code == 403
    assert client.get(f"/api/v1/tenants/{ids['tenant_b']}/notification-config", headers=h).status_code == 403


# --- Account takeover paths ------------------------------------------------------------------------

def test_password_cannot_be_set_through_user_update(env):
    client, ids = env
    resp = client.put(f"/api/v1/auth/users/{ids['admin_a']}", json={"password": "Hijack123!"},
                      headers=headers(ids, "admin_a"))
    assert resp.status_code == 400


def test_student_cannot_edit_others_or_escalate_self(env):
    client, ids = env
    h = headers(ids, "student_a")
    assert client.put(f"/api/v1/auth/users/{ids['admin_a']}", json={"first_name": "X"}, headers=h).status_code == 403
    assert client.put(f"/api/v1/auth/users/{ids['student_a']}", json={"is_active": True}, headers=h).status_code == 403
    ok = client.put(f"/api/v1/auth/users/{ids['student_a']}", json={"first_name": "Ama"}, headers=h)
    assert ok.status_code == 200 and ok.json()["first_name"] == "Ama"


def test_school_admin_cannot_reach_super_admin(env):
    client, ids = env
    h = headers(ids, "admin_a")  # same school as the super-admin account
    assert client.get(f"/api/v1/auth/users/{ids['super']}", headers=h).status_code == 404
    assert client.post(f"/api/v1/auth/admin/reset-password/{ids['super']}", headers=h).status_code == 404
    assert client.get(f"/api/v1/auth/users/{ids['super']}/roles", headers=h).status_code == 404
    assert client.put("/api/v1/auth/roles/" + str(uuid4()) + "/permissions", json=["view_users"], headers=h).status_code == 404
    assert client.post("/api/v1/auth/roles", json={"name": "Super Admin"}, headers=h).status_code == 400


# --- Roles: built-in (shared) and per-school custom roles ------------------------------------

def _role_id(client, h, name):
    return next(r["id"] for r in client.get("/api/v1/auth/roles", headers=h).json() if r["name"] == name)


def test_school_admin_manages_only_own_custom_roles(env):
    client, ids = env
    ha, hb = headers(ids, "admin_a"), headers(ids, "admin_b")

    # Built-in roles are shared and read-only to schools
    admin_role = _role_id(client, ha, "admin")
    assert client.put(f"/api/v1/auth/roles/{admin_role}/permissions", json=["view_users"], headers=ha).status_code == 403
    for reserved in ("admin", "ADMIN", "student", "super_admin", "Principal"):
        assert client.post("/api/v1/auth/roles", json={"name": reserved}, headers=ha).status_code == 400

    created = client.post("/api/v1/auth/roles", json={"name": "Bursar"}, headers=ha)
    assert created.status_code == 201
    bursar = created.json()
    assert bursar["tenant_id"] == str(ids["tenant_a"]) and bursar["is_system"] is False

    # Its permissions: school permissions yes, platform-only no
    ok = client.put(f"/api/v1/auth/roles/{bursar['id']}/permissions", json=["view_financial_data"], headers=ha)
    assert ok.status_code == 200
    assert client.put(f"/api/v1/auth/roles/{bursar['id']}/permissions", json=["manage_tenants"], headers=ha).status_code == 403

    # School B can't see, edit or hand out school A's custom role, and can reuse the name
    assert "Bursar" not in {r["name"] for r in client.get("/api/v1/auth/roles", headers=hb).json()}
    assert client.put(f"/api/v1/auth/roles/{bursar['id']}/permissions", json=[], headers=hb).status_code == 404
    assert client.post(f"/api/v1/auth/users/{ids['admin_b']}/roles", json=[bursar["id"]], headers=hb).status_code == 404
    assert client.post("/api/v1/auth/roles", json={"name": "Bursar"}, headers=hb).status_code == 201

    # Assigned in its own school; can't be deleted while held
    assert client.post(f"/api/v1/auth/users/{ids['student_a']}/roles", json=[bursar["id"]], headers=ha).status_code == 200
    assert client.delete(f"/api/v1/auth/roles/{bursar['id']}", headers=ha).status_code == 409
    assert client.delete(f"/api/v1/auth/users/{ids['student_a']}/roles/{bursar['id']}", headers=ha).status_code == 200
    assert client.delete(f"/api/v1/auth/roles/{bursar['id']}", headers=ha).status_code == 200


def test_custom_role_named_like_super_admin_grants_nothing():
    from types import SimpleNamespace
    from src.core.security.auth import is_super_admin

    custom = SimpleNamespace(name="super-admin", tenant_id=uuid4())
    builtin = SimpleNamespace(name="super-admin", tenant_id=None)
    assert not is_super_admin(SimpleNamespace(roles=[custom]))
    assert is_super_admin(SimpleNamespace(roles=[builtin]))


def test_finance_is_staff_only(env):
    client, ids = env
    assert client.get("/api/v1/finance/fees/categories", headers=headers(ids, "student_a")).status_code == 403
    assert client.get("/api/v1/finance/fees/student-fees/export/xlsx", headers=headers(ids, "student_a")).status_code == 403
    assert client.get("/api/v1/super-admin/dashboard/tenant-stats", headers=headers(ids, "admin_a")).status_code == 403


# --- Passwords --------------------------------------------------------------------------------

def test_first_login_only_allows_profile_and_password_change(env):
    client, ids = env
    h = headers(ids, "new_admin_a")
    assert client.get("/api/v1/auth/me", headers=h).status_code == 200
    blocked = client.get("/api/v1/auth/users", headers=h)
    assert blocked.status_code == 403
    assert blocked.headers.get("X-Password-Change-Required") == "1"
    # The password check runs before the policy check, so a wrong current password is a 400 not a 403
    resp = client.post("/api/v1/auth/change-password", headers=h,
                       json={"current_password": "wrong", "new_password": "N3w!password"})
    assert resp.status_code == 400


def test_admin_supplied_passwords_must_meet_policy():
    from pydantic import ValidationError
    from src.schemas.auth.user import UserCreate

    with pytest.raises(ValidationError):
        UserCreate(email="a@b.org", first_name="A", last_name="B", password="short")
    assert UserCreate(email="a@b.org", first_name="A", last_name="B", password="").password == ""
    assert UserCreate(email="a@b.org", first_name="A", last_name="B", password="Str0ng!pass").password


def test_generated_passwords_meet_policy():
    from src.core.security.password import generate_default_password
    from src.core.security.password_policy import PasswordPolicy

    policy = PasswordPolicy()
    for _ in range(200):
        assert policy.validate(generate_default_password()) == []

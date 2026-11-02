"""Staff accounts a school creates itself (POST /auth/staff-accounts, GET /auth/staff-roles): one
school only, staff roles only, a one-time password that must be changed, admins protected."""
from uuid import UUID, uuid4

import main
from src.core.security.password import verify_password
from src.db.models.auth.admin import Admin
from src.db.models.auth.permission import Permission
from src.db.models.auth.user import User
from src.db.models.auth.user_role import UserRole
from src.db.session import get_db

from test_security import env, headers  # noqa: F401  shared app + two-school fixture

CREATE = "/api/v1/auth/staff-accounts"
ROLES = "/api/v1/auth/staff-roles"


def _db():
    gen = main.app.dependency_overrides[get_db]()
    return gen, next(gen)


def _roles(ids):
    """Built-in staff roles, family roles, school B's custom role, and a registrar in school A who
    may manage users but isn't an admin."""
    gen, db = _db()
    manage = db.query(Permission).filter(Permission.name == "manage_users").one()
    made = {name: UserRole(name=name) for name in ("registrar", "accountant", "academic-admin", "parent", "teacher")}
    made["registrar"].permissions = [manage]
    made["bursar_b"] = UserRole(name="bursar", tenant_id=ids["tenant_b"], is_system=False)
    db.add_all(made.values())
    registrar = Admin(tenant_id=ids["tenant_a"], email=f"{uuid4().hex[:8]}@school-a.org", password_hash="x",
                      first_name="Rita", last_name="Registrar", is_first_login=False)
    registrar.roles.append(made["registrar"])
    db.add(registrar)
    db.flush()
    out = {name: str(role.id) for name, role in made.items()}
    out["admin"] = str(db.query(UserRole).filter(UserRole.name == "admin").one().id)
    out["student"] = str(db.query(UserRole).filter(UserRole.name == "student").one().id)
    out["super-admin"] = str(db.query(UserRole).filter(UserRole.name == "super-admin").one().id)
    ids["registrar"] = registrar.id
    next(gen, None)
    return out


def test_admin_creates_a_staff_account_with_a_one_time_password(env, monkeypatch):
    client, ids = env
    roles = _roles(ids)
    monkeypatch.setattr("src.services.notification.email_service.EmailService.send_password_notification",
                        lambda *a, **k: (_ for _ in ()).throw(AssertionError("password emailed")))

    r = client.post(CREATE, json={"first_name": "Ama", "last_name": "Kollie", "role_id": roles["accountant"]},
                    headers=headers(ids, "admin_a"))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["username"] == "ama.kollie" and body["email"] is None and body["role"] == "accountant"
    [cred] = body["credentials"]
    assert cred["username"] == "ama.kollie" and cred["password"]

    gen, db = _db()
    user = db.query(User).filter(User.id == UUID(body["id"])).one()
    assert user.tenant_id == ids["tenant_a"] and user.is_first_login is True and user.is_active is True
    assert [role.name for role in user.roles] == ["accountant"]
    assert verify_password(cred["password"], user.password_hash)
    next(gen, None)

    # a username and email of their own; taken ones are refused
    r = client.post(CREATE, json={"first_name": "Joe", "last_name": "Doe", "email": "joe@school-a.org",
                                  "username": "Bursar.Joe", "role_id": roles["academic-admin"]},
                    headers=headers(ids, "admin_a"))
    assert r.status_code == 201 and r.json()["username"] == "bursar.joe"
    again = {"first_name": "J", "last_name": "D", "role_id": roles["accountant"]}
    assert client.post(CREATE, json={**again, "username": "bursar.joe"}, headers=headers(ids, "admin_a")).status_code == 409
    assert client.post(CREATE, json={**again, "email": "JOE@school-a.org"}, headers=headers(ids, "admin_a")).status_code == 409
    assert client.post(CREATE, json={**again, "username": "no spaces"}, headers=headers(ids, "admin_a")).status_code == 422
    # the same username is free in another school
    assert client.post(CREATE, json={**again, "username": "bursar.joe", "role_id": roles["bursar_b"]},
                       headers=headers(ids, "admin_b")).status_code == 201


def test_only_staff_roles_of_this_school(env):
    client, ids = env
    roles = _roles(ids)
    h = headers(ids, "admin_a")
    person = {"first_name": "Ama", "last_name": "Kollie"}
    assert client.post(CREATE, json={**person, "role_id": roles["super-admin"]}, headers=h).status_code == 404
    assert client.post(CREATE, json={**person, "role_id": roles["bursar_b"]}, headers=h).status_code == 404  # school B's
    assert client.post(CREATE, json={**person, "role_id": roles["student"]}, headers=h).status_code == 400
    assert client.post(CREATE, json={**person, "role_id": roles["parent"]}, headers=h).status_code == 400
    assert client.post(CREATE, json={**person, "role_id": roles["teacher"]}, headers=h).status_code == 400

    names = {r["name"] for r in client.get(ROLES, headers=h).json()}
    assert {"admin", "registrar", "accountant", "academic-admin"} <= names
    assert not names & {"super-admin", "student", "parent", "teacher", "bursar"}
    assert "bursar" in {r["name"] for r in client.get(ROLES, headers=headers(ids, "admin_b")).json()}


def test_only_a_school_admin_creates_an_admin(env):
    client, ids = env
    roles = _roles(ids)
    person = {"first_name": "Ama", "last_name": "Kollie"}
    r = client.post(CREATE, json={**person, "role_id": roles["admin"]}, headers=headers(ids, "registrar"))
    assert r.status_code == 403 and "admin" in r.json()["detail"]
    assert "admin" not in {r["name"] for r in client.get(ROLES, headers=headers(ids, "registrar")).json()}
    # the registrar may still add other staff; the admin may add an admin
    assert client.post(CREATE, json={**person, "role_id": roles["accountant"]},
                       headers=headers(ids, "registrar")).status_code == 201
    assert client.post(CREATE, json={**person, "role_id": roles["admin"]}, headers=headers(ids, "admin_a")).status_code == 201
    # without manage_users: nothing
    assert client.post(CREATE, json={**person, "role_id": roles["accountant"]},
                       headers=headers(ids, "student_a")).status_code == 403
    assert client.get(ROLES, headers=headers(ids, "student_a")).status_code == 403

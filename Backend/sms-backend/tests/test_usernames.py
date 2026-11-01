"""Usernames: every account has one, unique per school; sign in with email or username."""
from sqlalchemy.orm import sessionmaker

from src.core.security.password import get_password_hash
from src.db.models.auth.admin import Admin
from src.db.models.auth.user import User
from src.db.models.auth.username import first_free, username_base
from src.db.session import get_db
import main

from test_security import env, headers  # noqa: F401  shared app + two-school fixture


def _session():
    gen = main.app.dependency_overrides[get_db]()
    return gen, next(gen)


def test_username_rules():
    assert username_base("Ama", "Kollie") == "ama.kollie"
    assert username_base("Zoë", "N'Dri") == "zoe.ndri"
    assert username_base("", "", "j.doe+1@x.org") == "j.doe.1"
    assert username_base("", "", None) == "user"
    assert first_free("ama.kollie", {"ama.kollie", "ama.kollie2"}) == "ama.kollie3"


def test_accounts_get_unique_usernames_per_school(env):
    client, ids = env
    gen, db = _session()
    for tenant in (ids["tenant_a"], ids["tenant_a"], ids["tenant_b"]):
        db.add(Admin(tenant_id=tenant, email=None, password_hash="x", first_name="Ama", last_name="Kollie"))
    next(gen, None)  # commit
    gen, db = _session()
    names = sorted((str(u.tenant_id), u.username) for u in db.query(User).filter(User.first_name == "Ama"))
    assert names == sorted([
        (str(ids["tenant_a"]), "ama.kollie"), (str(ids["tenant_a"]), "ama.kollie2"),
        (str(ids["tenant_b"]), "ama.kollie"),  # another school can reuse it
    ])


def test_sign_in_with_username_or_email(env):
    client, ids = env
    gen, db = _session()
    db.add(Admin(tenant_id=ids["tenant_a"], email="kofi@school-a.org", username="kofi.mensah",
                 password_hash=get_password_hash("Str0ng!pass"), first_name="Kofi", last_name="Mensah",
                 is_first_login=False))
    next(gen, None)
    school = {"X-Tenant-ID": str(ids["tenant_a"])}
    for identifier in ("kofi.mensah", "KOFI.Mensah", "kofi@school-a.org"):
        resp = client.post("/api/v1/auth/login", data={"username": identifier, "password": "Str0ng!pass"}, headers=school)
        assert resp.status_code == 200, (identifier, resp.text)
    # Not from another school's page
    other = {"X-Tenant-ID": str(ids["tenant_b"])}
    assert client.post("/api/v1/auth/login", data={"username": "kofi.mensah", "password": "Str0ng!pass"},
                       headers=other).status_code == 401


def test_admin_creates_account_without_email_and_duplicate_username_is_409(env):
    client, ids = env
    h = headers(ids, "admin_a")
    resp = client.post("/api/v1/auth/users", json={"first_name": "Esi", "last_name": "Dahn"}, headers=h)
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    assert body["email"] is None and body["username"] == "esi.dahn" and body["generated_password"]

    resp = client.post("/api/v1/auth/users", json={"first_name": "X", "last_name": "Y", "username": "Esi.Dahn"}, headers=h)
    assert resp.status_code == 409 and "username" in resp.json()["detail"]

    bad = client.post("/api/v1/auth/users", json={"first_name": "X", "last_name": "Y", "username": "has space"}, headers=h)
    assert bad.status_code == 422

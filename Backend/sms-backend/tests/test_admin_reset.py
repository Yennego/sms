"""School office password resets (POST /auth/admin/reset-password/{id}) and the Users page directory
(GET /auth/users/directory): one school only, never emailed, sessions end, admins protected."""
from datetime import datetime, timedelta, UTC
from uuid import uuid4

import main
from src.db.models.auth.admin import Admin
from src.db.models.auth.permission import Permission
from src.db.models.auth.user_role import UserRole
from src.db.models.people.parent import Parent
from src.db.session import get_db
from src.services.auth.token_blacklist import TokenBlacklistService

from test_security import env, headers  # noqa: F401  shared app + two-school fixture

RESET = "/api/v1/auth/admin/reset-password"
DIRECTORY = "/api/v1/auth/users/directory"


def _db():
    gen = main.app.dependency_overrides[get_db]()
    return gen, next(gen)


def _office_and_parent(ids):
    """School A: a registrar who may manage users but isn't an admin, and a parent without email."""
    gen, db = _db()
    perms = []
    for name in ("manage_users", "view_users"):
        p = db.query(Permission).filter(Permission.name == name).first() or Permission(name=name)
        db.add(p)
        perms.append(p)
    registrar_role = UserRole(name="registrar")
    registrar_role.permissions = perms
    parent_role = db.query(UserRole).filter(UserRole.name == "parent").first() or UserRole(name="parent")
    db.add_all([registrar_role, parent_role])
    registrar = Admin(tenant_id=ids["tenant_a"], email=f"{uuid4().hex[:8]}@school-a.org", password_hash="x",
                      first_name="Rita", last_name="Registrar", is_first_login=False)
    registrar.roles.append(registrar_role)
    parent = Parent(tenant_id=ids["tenant_a"], email=None, password_hash="x", first_name="Mary", last_name="Kollie",
                    is_first_login=False, relationship_type="mother")
    parent.roles.append(parent_role)
    db.add_all([registrar, parent])
    db.flush()
    ids.update(registrar=registrar.id, parent=parent.id, parent_username=parent.username)
    next(gen, None)


def test_reset_hands_over_a_password_and_ends_sessions(env, monkeypatch):
    client, ids = env
    _office_and_parent(ids)
    revoked = []

    async def fake_revoke(self, user_id):
        revoked.append(str(user_id))
        return True
    monkeypatch.setattr(TokenBlacklistService, "revoke_user_sessions", fake_revoke)
    # never emailed: the email service must not be reached
    monkeypatch.setattr("src.services.notification.email_service.EmailService.send_password_notification",
                        lambda *a, **k: (_ for _ in ()).throw(AssertionError("password emailed")))

    r = client.post(f"{RESET}/{ids['parent']}", headers=headers(ids, "admin_a"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["generated_password"] and body["username"] == ids["parent_username"] and body["email"] is None
    assert revoked == [str(ids["parent"])]

    gen, db = _db()
    parent = db.query(Parent).filter(Parent.id == ids["parent"]).one()
    assert parent.is_first_login is True
    next(gen, None)


def test_reset_stays_in_its_school_and_protects_admins(env):
    client, ids = env
    _office_and_parent(ids)
    # another school's account, and a platform account: 404
    assert client.post(f"{RESET}/{ids['admin_b']}", headers=headers(ids, "admin_a")).status_code == 404
    assert client.post(f"{RESET}/{ids['student_a']}", headers=headers(ids, "admin_b")).status_code == 404
    assert client.post(f"{RESET}/{ids['super']}", headers=headers(ids, "admin_a")).status_code == 404
    # the registrar resets families and students, but not an admin
    assert client.post(f"{RESET}/{ids['student_a']}", headers=headers(ids, "registrar")).status_code == 200
    r = client.post(f"{RESET}/{ids['admin_a']}", headers=headers(ids, "registrar"))
    assert r.status_code == 403 and "admin" in r.json()["detail"]
    # an admin may reset another admin; nobody resets themself here
    assert client.post(f"{RESET}/{ids['new_admin_a']}", headers=headers(ids, "admin_a")).status_code == 200
    assert client.post(f"{RESET}/{ids['admin_a']}", headers=headers(ids, "admin_a")).status_code == 400
    # a student can't reset anyone
    assert client.post(f"{RESET}/{ids['parent']}", headers=headers(ids, "student_a")).status_code == 403


def test_directory_is_paged_searchable_and_one_school(env):
    client, ids = env
    _office_and_parent(ids)
    h = headers(ids, "admin_a")
    r = client.get(DIRECTORY, params={"page_size": 2}, headers=h)
    assert r.status_code == 200, r.text
    page = r.json()
    names = set()
    for n in range(1, page["pages"] + 1):
        names |= {str(i["id"]) for i in client.get(DIRECTORY, params={"page": n, "page_size": 2}, headers=h).json()["items"]}
    assert len(names) == page["total"]
    assert str(ids["admin_b"]) not in names and str(ids["student_b"]) not in names  # other school
    assert str(ids["super"]) not in names  # platform account
    assert str(ids["parent"]) in names

    found = client.get(DIRECTORY, params={"q": ids["parent_username"]}, headers=h).json()["items"]
    assert [i["id"] for i in found] == [str(ids["parent"])] and found[0]["roles"] == ["parent"]
    assert {i["id"] for i in client.get(DIRECTORY, params={"role": "parent"}, headers=h).json()["items"]} == {str(ids["parent"])}
    assert client.get(DIRECTORY, params={"status": "inactive"}, headers=h).json()["total"] == 0
    assert client.get(DIRECTORY, headers=headers(ids, "student_a")).status_code == 403


def test_cleanup_removes_only_old_unreferenced_files(env, tmp_path):
    """Replaced or abandoned uploads go after a day; anything newer stays."""
    import os
    from src.db.models.resources.file import StoredFile
    from src.services import files
    from src.services.files.storage import LocalFileStorage

    client, ids = env
    storage = LocalFileStorage(tmp_path)
    files.set_storage(storage)
    gen, db = _db()
    try:
        old_row = files.store_file(db, ids["tenant_a"], b"old", filename="a.pdf", content_type="application/pdf")
        new_row = files.store_file(db, ids["tenant_a"], b"new", filename="b.pdf", content_type="application/pdf")
        old_row.created_at = datetime.now(UTC) - timedelta(days=2)
        storage.put("stray/old", b"x", "text/plain")
        storage.put("stray/new", b"x", "text/plain")
        two_days_ago = (datetime.now(UTC) - timedelta(days=2)).timestamp()
        for key in ("stray/old", old_row.storage_key, new_row.storage_key):
            os.utime(storage._path(key), (two_days_ago, two_days_ago))  # the new row's bytes: old, but known
        db.commit()
        old_key, new_id = old_row.storage_key, new_row.id

        assert files.cleanup_unreferenced(db) == (1, 1)
        assert not storage._path(old_key).exists() and not storage._path("stray/old").exists()
        assert storage._path(new_row.storage_key).exists() and storage._path("stray/new").exists()
        assert [r.id for r in db.query(StoredFile).all()] == [new_id]
    finally:
        files.set_storage(None)
        next(gen, None)


def test_deactivated_parent_cannot_sign_in(env):
    """Parent once hid users.is_active behind a method, so this check always passed for parents."""
    client, ids = env
    _office_and_parent(ids)
    gen, db = _db()
    parent = db.query(Parent).filter(Parent.id == ids["parent"]).one()
    assert parent.is_active is True
    parent.is_active = False
    db.commit()
    next(gen, None)
    assert client.get("/api/v1/auth/me", headers=headers(ids, "parent")).status_code == 401

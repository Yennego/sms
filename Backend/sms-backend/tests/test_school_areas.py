"""The school's ceiling: switchable areas the operator turns off are refused for the whole school,
admins included, while the other school and the always-on areas carry on."""
import main
from src.db.models.tenant import TenantSettings
from src.db.session import get_db

from test_security import env, headers  # noqa: F401  shared app + two-school fixture

A = "/api/v1/academics"


def _switch(ids, **features):
    gen = main.app.dependency_overrides[get_db]()
    db = next(gen)
    row = db.query(TenantSettings).filter(TenantSettings.tenant_id == ids["tenant_a"]).one()
    row.settings = {**row.settings, "features": {**(row.settings.get("features") or {}), **features}}
    next(gen, None)


def test_areas_default_on_and_are_listed(env):
    client, ids = env
    areas = client.get("/api/v1/tenants/self/areas", headers=headers(ids, "admin_a"))
    assert areas.status_code == 200, areas.text
    by_key = {a["key"]: a for a in areas.json()}
    assert {"fees", "attendance", "homework", "timetable", "announcements"} <= set(by_key)
    assert all(by_key[k]["enabled"] for k in ("attendance", "homework", "timetable", "announcements"))
    assert "mark_attendance" in by_key["attendance"]["permissions"]
    # anyone signed in may read it (the menus and role screens use it)
    assert client.get("/api/v1/tenants/self/areas", headers=headers(ids, "student_a")).status_code == 200


def test_switched_off_area_is_refused_for_admins_too(env):
    client, ids = env
    h = headers(ids, "admin_a")
    calendar = f"{A}/attendance/calendar?start_date=2026-11-01&end_date=2026-11-30"
    assert client.get(calendar, headers=h).status_code == 200

    _switch(ids, enable_attendance=False, enable_homework=False, enable_timetable=False,
            enable_announcements=False)

    for url in (calendar, f"{A}/attendance/settings", f"{A}/assignments", f"{A}/timetables",
                "/api/v1/communication/announcements"):
        r = client.get(url, headers=h)
        assert r.status_code == 403 and "turned off" in r.json()["detail"], (url, r.text)
    refused = client.post("/api/v1/communication/announcements", json={}, headers=h)
    assert refused.status_code == 403
    off = {a["key"] for a in client.get("/api/v1/tenants/self/areas", headers=h).json() if not a["enabled"]}
    assert off == {"attendance", "homework", "timetable", "announcements"}  # fees stays on in this fixture

    # always-on areas carry on; the inbox stays (school alerts arrive there), and so does the
    # parent's list of children (the results and fees pages use it)
    children = client.get(f"{A}/attendance/daily/my-children", headers=h)  # parents only, but not switched off
    assert "turned off" not in children.text
    assert client.get(f"{A}/classes", headers=h).status_code == 200
    assert client.get("/api/v1/people/students", headers=h).status_code == 200
    assert client.get("/api/v1/communication/inbox", headers=h).status_code == 200
    # the other school is unaffected
    hb = headers(ids, "admin_b")
    assert client.get(f"{A}/attendance/settings", headers=hb).status_code != 403


def _parent(ids, also_teacher=False):
    """A parent of school A who signs in with a password (a teacher too when asked)."""
    from src.core.security.password import get_password_hash
    from src.db.models.auth.user_role import UserRole
    from src.db.models.people.parent import Parent
    gen = main.app.dependency_overrides[get_db]()
    db = next(gen)
    parent_role = db.query(UserRole).filter(UserRole.name == "parent").first() or UserRole(name="parent")
    parent = Parent(tenant_id=ids["tenant_a"], email=None, password_hash=get_password_hash("Str0ng!pass"),
                    first_name="Mary", last_name="Kollie", is_first_login=False, relationship_type="mother")
    parent.roles.append(parent_role)
    if also_teacher:
        parent.roles.append(db.query(UserRole).filter(UserRole.name == "teacher").first() or UserRole(name="teacher"))
    db.add(parent)
    db.flush()
    ids["parent"], username = parent.id, parent.username
    next(gen, None)
    return username


def test_parent_portal_switched_off(env):
    """Parents can't sign in, and a signed-in parent is refused, while the portal is off; staff carry on."""
    client, ids = env
    username = _parent(ids)
    school = {"X-Tenant-ID": str(ids["tenant_a"])}
    login = lambda: client.post("/api/v1/auth/login", data={"username": username, "password": "Str0ng!pass"},  # noqa: E731
                                headers=school)
    assert login().status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers(ids, "parent")).status_code == 200

    _switch(ids, enable_parent_portal=False)
    refused = login()
    assert refused.status_code == 403 and "parent portal is turned off" in refused.json()["detail"]
    signed_in = client.get("/api/v1/auth/me", headers=headers(ids, "parent"))
    assert signed_in.status_code == 403 and "parent portal" in signed_in.json()["detail"]
    assert client.post("/api/v1/auth/logout", headers=headers(ids, "parent")).status_code != 403
    # staff and students are unaffected
    assert client.get("/api/v1/auth/me", headers=headers(ids, "admin_a")).status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers(ids, "student_a")).status_code == 200
    off = {a["key"] for a in client.get("/api/v1/tenants/self/areas", headers=headers(ids, "admin_a")).json()
           if not a["enabled"]}
    assert off == {"parent_portal"}

    _switch(ids, enable_parent_portal=True)
    assert login().status_code == 200


def test_a_teacher_who_is_also_a_parent_keeps_access(env):
    client, ids = env
    _parent(ids, also_teacher=True)
    _switch(ids, enable_parent_portal=False)
    assert client.get("/api/v1/auth/me", headers=headers(ids, "parent")).status_code == 200

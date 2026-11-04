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

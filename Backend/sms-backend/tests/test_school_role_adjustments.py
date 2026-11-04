"""A built-in role adjusted for one school only (role_permission_overrides): the platform operator
adds or takes away permissions for that school, every other school keeps the role as it is, and
every permission check sees the adjustment."""
import pytest

import main
from src.db.session import get_db, get_super_admin_db

from test_security import env, headers  # noqa: F401  shared app + two-school fixture


@pytest.fixture
def platform(env):  # noqa: F811
    client, ids = env
    main.app.dependency_overrides[get_super_admin_db] = main.app.dependency_overrides[get_db]
    return client, ids


def _role_id(client, h, name):
    return next(r["id"] for r in client.get("/api/v1/auth/roles", headers=h).json() if r["name"] == name)


def _me(client, ids, who):
    return set(client.get("/api/v1/auth/me", headers=headers(ids, who)).json()["permissions"])


def test_a_role_adjusted_for_one_school(platform):
    client, ids = platform
    hs, ha, hb = headers(ids, "super"), headers(ids, "admin_a"), headers(ids, "admin_b")
    admin_role = _role_id(client, ha, "admin")
    url = f"/api/v1/super-admin/tenants/{ids['tenant_a']}/roles/{admin_role}/permissions"
    assert client.post("/api/v1/auth/permissions", json={"name": "manage_counseling_notes"}, headers=hs).status_code == 201

    before = client.get(url, headers=hs).json()
    assert before["adjusted"] is False and before["permissions"] == before["built_in"]
    assert "view_financial_data" in _me(client, ids, "admin_a")

    wanted = [p for p in before["built_in"] if p != "view_financial_data"] + ["manage_counseling_notes"]
    saved = client.put(url, json={"permission_names": wanted}, headers=hs)
    assert saved.status_code == 200, saved.text
    assert saved.json()["added"] == ["manage_counseling_notes"] and saved.json()["removed"] == ["view_financial_data"]

    # school A's admins: the adjusted role, everywhere permissions are checked
    mine = _me(client, ids, "admin_a")
    assert "view_financial_data" not in mine and "manage_counseling_notes" in mine
    assert client.get("/api/v1/finance/expenses", headers=ha).status_code == 403
    listed = next(r for r in client.get("/api/v1/auth/roles", headers=ha).json() if r["name"] == "admin")
    assert listed["adjusted_for_school"] is True
    assert {"manage_counseling_notes"} <= {p["name"] for p in listed["permissions"]}
    assert "view_financial_data" not in {p["name"] for p in listed["permissions"]}
    adjusted = client.get(f"/api/v1/super-admin/tenants/{ids['tenant_a']}/role-adjustments", headers=hs).json()
    assert adjusted == [{"role_id": admin_role, "added": ["manage_counseling_notes"], "removed": ["view_financial_data"]}]

    # school B keeps the built-in role
    theirs = _me(client, ids, "admin_b")
    assert "view_financial_data" in theirs and "manage_counseling_notes" not in theirs
    assert client.get("/api/v1/finance/expenses", headers=hb).status_code == 200
    listed_b = next(r for r in client.get("/api/v1/auth/roles", headers=hb).json() if r["name"] == "admin")
    assert listed_b["adjusted_for_school"] is False

    # back to the built-in role
    reset = client.delete(url, headers=hs)
    assert reset.status_code == 200 and reset.json()["adjusted"] is False
    assert "view_financial_data" in _me(client, ids, "admin_a")
    assert client.get("/api/v1/finance/expenses", headers=ha).status_code == 200


def test_only_the_operator_adjusts_and_never_with_platform_permissions(platform):
    client, ids = platform
    hs, ha = headers(ids, "super"), headers(ids, "admin_a")
    admin_role = _role_id(client, ha, "admin")
    url = f"/api/v1/super-admin/tenants/{ids['tenant_a']}/roles/{admin_role}/permissions"
    assert client.put(url, json={"permission_names": []}, headers=ha).status_code == 403
    platform_only = client.put(url, json={"permission_names": ["manage_tenants"]}, headers=hs)
    assert platform_only.status_code == 400 and "platform-only" in platform_only.json()["detail"]
    assert client.put(url, json={"permission_names": ["no_such_thing"]}, headers=hs).status_code == 400

    # a school's own role is changed directly, not adjusted
    own = client.post("/api/v1/auth/roles", json={"name": "Bursar"}, headers=hs).json()
    r = client.get(f"/api/v1/super-admin/tenants/{ids['tenant_a']}/roles/{own['id']}/permissions", headers=hs)
    assert r.status_code == 400

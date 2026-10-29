"""Platform user list: server paging, search, filters, sorting and totals (super-admin only)."""
import main
from src.db.models.auth.admin import Admin
from src.db.session import get_db, get_super_admin_db

from test_security import env, headers  # noqa: F401  shared app + two-school fixture

URL = "/api/v1/super-admin/users"


def _seed(ids, n=30):
    main.app.dependency_overrides[get_super_admin_db] = main.app.dependency_overrides[get_db]
    gen = main.app.dependency_overrides[get_db]()
    db = next(gen)
    for i in range(n):
        db.add(Admin(tenant_id=ids["tenant_b"], first_name=f"Page{i:02d}", last_name="Tester",
                     email=f"page{i:02d}@school-b.org", password_hash="x", is_active=i % 5 != 0))
    next(gen, None)


def test_pages_do_not_overlap_and_totals_cover_every_page(env):
    client, ids = env
    _seed(ids)
    h = headers(ids, "super")
    first = client.get(f"{URL}?q=tester&skip=0&limit=10&sort_by=email", headers=h).json()
    second = client.get(f"{URL}?q=tester&skip=10&limit=10&sort_by=email", headers=h).json()
    third = client.get(f"{URL}?q=tester&skip=20&limit=10&sort_by=email", headers=h).json()
    emails = [u["email"] for page in (first, second, third) for u in page["items"]]
    assert len(emails) == 30 and len(set(emails)) == 30 and emails == sorted(emails)
    assert first["total"] == 30 and first["has_next"] and not third["has_next"]
    assert first["counts"] == {"all": 30, "active": 24, "inactive": 6}


def test_search_filters_and_sorting(env):
    client, ids = env
    _seed(ids)
    h = headers(ids, "super")
    assert client.get(f"{URL}?q=page07", headers=h).json()["total"] == 1
    assert client.get(f"{URL}?q=tester&is_active=false", headers=h).json()["total"] == 6
    school_a = client.get(f"{URL}?tenant_id={ids['tenant_a']}", headers=h).json()
    assert all(u["tenant_id"] == str(ids["tenant_a"]) for u in school_a["items"])
    newest = client.get(f"{URL}?q=tester&sort_by=email&sort_order=desc&limit=1", headers=h).json()
    assert newest["items"][0]["email"] == "page29@school-b.org"
    assert client.get(f"{URL}?sort_by=password_hash", headers=h).status_code == 422
    assert client.get(f"{URL}?limit=500", headers=h).status_code == 422


def test_only_super_admins_list_users(env):
    client, ids = env
    assert client.get(URL, headers=headers(ids, "admin_a")).status_code == 403

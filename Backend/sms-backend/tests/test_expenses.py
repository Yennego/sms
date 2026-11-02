"""Expenses: each one has a currency (USD or LRD); totals are per currency and never added
together; categories and expenses stay inside their school."""
from test_security import env, headers  # noqa: F401  shared app + two-school fixture

E = "/api/v1/finance/expenses"


def _category(client, ids, who="admin_a", name="Supplies"):
    r = client.post(f"{E}/categories", json={"name": name}, headers=headers(ids, who))
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _expense(client, ids, category, amount, currency, who="admin_a"):
    return client.post(E, json={"expense_category_id": category, "amount": amount, "currency": currency,
                                 "date": "2026-10-20", "payee": "Shop"}, headers=headers(ids, who))


def test_new_expense_needs_a_valid_currency(env):
    client, ids = env
    cat = _category(client, ids)
    h = headers(ids, "admin_a")
    body = {"expense_category_id": cat, "amount": "10", "date": "2026-10-20"}
    assert client.post(E, json=body, headers=h).status_code == 422
    assert client.post(E, json={**body, "currency": "EUR"}, headers=h).status_code == 422
    r = _expense(client, ids, cat, "12.5", "LRD")
    assert r.status_code == 200, r.text
    assert r.json()["currency"] == "LRD" and r.json()["amount"] == "12.50"  # money is a string


def test_currency_can_be_changed_but_not_cleared(env):
    client, ids = env
    cat = _category(client, ids)
    exp = _expense(client, ids, cat, "40", "USD").json()
    h = headers(ids, "admin_a")
    r = client.put(f"{E}/{exp['id']}", json={"currency": "LRD"}, headers=h)
    assert r.status_code == 200 and r.json()["currency"] == "LRD"
    assert client.put(f"{E}/{exp['id']}", json={"currency": None}, headers=h).status_code == 422
    r = client.put(f"{E}/{exp['id']}", json={"payee": "Market"}, headers=h)  # left out: kept
    assert r.status_code == 200 and r.json()["currency"] == "LRD"


def test_summary_is_per_currency_and_per_school(env):
    client, ids = env
    cat = _category(client, ids)
    for amount, currency in (("100.10", "USD"), ("0.20", "USD"), ("5000", "LRD")):
        assert _expense(client, ids, cat, amount, currency).status_code == 200
    other = _category(client, ids, who="admin_b")
    assert _expense(client, ids, other, "999", "USD", who="admin_b").status_code == 200

    r = client.get(f"{E}/summary", headers=headers(ids, "admin_a"))
    assert r.status_code == 200
    assert r.json() == {"total_spent": {"USD": "100.30", "LRD": "5000.00"}}
    r = client.get(f"{E}/summary", headers=headers(ids, "admin_b"))
    assert r.json() == {"total_spent": {"USD": "999.00", "LRD": "0.00"}}


def test_expense_cannot_use_another_schools_category(env):
    client, ids = env
    other = _category(client, ids, who="admin_b")
    assert _expense(client, ids, other, "10", "USD").status_code == 404
    mine = _category(client, ids)
    exp = _expense(client, ids, mine, "10", "USD").json()
    r = client.put(f"{E}/{exp['id']}", json={"expense_category_id": other}, headers=headers(ids, "admin_a"))
    assert r.status_code == 404

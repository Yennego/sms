"""Phase 7 platform billing: billable months, the staff and family counts, invoice lines, idempotent
issue, currency lock, receipts and voids, status at 30 and 60 days with grace and dormant, reminders,
enforcement of read-only and suspended, usage recorded at sign-in, and the school's own endpoints."""
import csv
import io
import zipfile
from datetime import date, datetime, timedelta, UTC
from decimal import Decimal
from types import SimpleNamespace

import pytest

import main
from src.core.security.password import get_password_hash
from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.semester import Semester
from src.db.models.auth.admin import Admin
from src.db.models.auth.user_role import UserRole
from src.db.models.billing import (
    PlatformInvoice, PlatformPrice, PlatformReminder, SchoolSubscription, UserActivityMonth,
)
from src.db.models.communication.notification import Notification
from src.db.models.people.parent import Parent
from src.db.models.people.student import Student
from src.db.session import get_db, get_super_admin_db
from src.services.billing import platform_billing as pb
from src.services.billing.platform_billing import BillingService, Usage, billable_months, target_status, term_lines

from test_security import env, headers  # noqa: F401  shared app + two-school fixture

SA = "/api/v1/super-admin/billing"
B = "/api/v1/billing"
PASSWORD = "Str0ng!pass"
PREFS = "/api/v1/communication/preferences"
OFF = [{"event": "announcement", "email": False}]  # a small change any signed-in user may make


@pytest.fixture
def billing_env(env):
    """The shared two-school app, with platform routes (super-admin sessions) on the test database too."""
    main.app.dependency_overrides[get_super_admin_db] = main.app.dependency_overrides[get_db]
    return env


@pytest.fixture
def clock(monkeypatch):
    """Fix "now" (UTC; Africa/Monrovia is UTC+0)."""
    state = {"now": datetime(2027, 2, 1, 10, 0, tzinfo=UTC)}
    monkeypatch.setattr(pb, "_now", lambda: state["now"])

    def set_day(d: date):
        state["now"] = datetime(d.year, d.month, d.day, 10, 0, tzinfo=UTC)
    return set_day


def _db():
    gen = main.app.dependency_overrides[get_db]()
    return gen, next(gen)


def _seed(ids, *, prices=True):
    """School A: semester 1 Sep-Dec 2026 and semester 2 Feb-Jun 2027 (January and July-August are
    holidays); a teacher (custom role), a parent, an inactive teacher. School B: one semester.
    Price list: staff USD 2 / LRD 380, family USD 0.50 / LRD 95, term minimum USD 30 / LRD 5,700."""
    gen, db = _db()
    a, b = ids["tenant_a"], ids["tenant_b"]
    teacher_role = UserRole(name="teacher")
    custom = UserRole(name="bursar", tenant_id=a)
    parent_role = UserRole(name="parent")
    db.add_all([teacher_role, custom, parent_role])
    db.flush()
    sems = {}
    for t, key, spans in ((a, "a", ((date(2026, 9, 1), date(2026, 12, 18)), (date(2027, 2, 1), date(2027, 6, 30)))),
                          (b, "b", ((date(2026, 9, 1), date(2027, 6, 30)),))):
        year = AcademicYear(tenant_id=t, name="2026/2027", start_date=date(2026, 9, 1), end_date=date(2027, 6, 30),
                            is_current=True, semester_1_start=spans[0][0], semester_1_end=spans[0][1],
                            semester_2_start=spans[-1][0], semester_2_end=spans[-1][1])
        db.add(year)
        db.flush()
        for n, (start, end) in enumerate(spans, 1):
            s = Semester(tenant_id=t, academic_year_id=year.id, name=f"Semester {n}", semester_number=n,
                         start_date=start, end_date=end)
            db.add(s)
            db.flush()
            sems[f"{key}{n}"] = s.id

    def person(cls, role, active=True, **extra):
        u = cls(tenant_id=a, email=f"{cls.__name__.lower()}{len(ids)}@school-a.org", password_hash="x",
                first_name="P", last_name=str(len(ids)), is_first_login=False, is_active=active, **extra)
        if role is not None:
            u.roles.append(role)
        db.add(u)
        db.flush()
        ids[f"p{len(ids)}"] = u.id
        return u

    teacher = person(Admin, custom)
    parent = person(Parent, parent_role, relationship_type="mother")
    person(Admin, teacher_role, active=False)  # inactive: not billed
    ids.update(teacher=teacher.id, parent=parent.id)
    if prices:
        db.add(PlatformPrice(effective_from=date(2026, 1, 1), staff_per_month_usd=Decimal("2"),
                             staff_per_month_lrd=Decimal("380"), family_per_month_usd=Decimal("0.50"),
                             family_per_month_lrd=Decimal("95"), term_minimum_usd=Decimal("30"),
                             term_minimum_lrd=Decimal("5700")))
    next(gen, None)
    return {k: str(v) for k, v in sems.items()}


def _activity(ids, rows):
    gen, db = _db()
    for who, month in rows:
        db.add(UserActivityMonth(tenant_id=ids["tenant_a"], user_id=ids[who], month=month))
    next(gen, None)


def _set_status(ids, status, tenant="tenant_a"):
    gen, db = _db()
    sub = BillingService(db).subscription(ids[tenant])
    sub.status = status
    next(gen, None)


def _issue(client, ids, sem, tenant="tenant_a"):
    r = client.post(f"{SA}/schools/{ids[tenant]}/invoices", json={"semester_id": sem}, headers=headers(ids, "super"))
    assert r.status_code == 200, r.text
    return r.json()


def _paid_term(client, ids, s, clock):
    """School A's first term is free; its second term is charged: invoice of USD 30 / LRD 5,700."""
    clock(date(2026, 9, 1))
    _issue(client, ids, s["a1"])
    clock(date(2027, 2, 1))
    inv = _issue(client, ids, s["a2"])
    return inv


def _job(ids, day, tenant="tenant_a"):
    gen, db = _db()
    out = BillingService(db).run_for_school(ids[tenant], day)
    next(gen, None)
    return out


# --- arithmetic --------------------------------------------------------------------------------------

def test_billable_months_skip_holidays_and_shared_months():
    s1 = SimpleNamespace(id="1", start_date=date(2026, 9, 1), end_date=date(2026, 12, 18))
    s2 = SimpleNamespace(id="2", start_date=date(2027, 2, 1), end_date=date(2027, 6, 30))
    assert [m.month for m in billable_months(s1, [s1, s2])] == [9, 10, 11, 12]
    assert [m.month for m in billable_months(s2, [s1, s2])] == [2, 3, 4, 5, 6]  # January is a holiday
    # Terms sharing a month: the earlier one takes it
    t1 = SimpleNamespace(id="a", start_date=date(2026, 9, 1), end_date=date(2027, 1, 15))
    t2 = SimpleNamespace(id="b", start_date=date(2027, 1, 20), end_date=date(2027, 3, 31))
    assert len(billable_months(t1, [t1, t2])) == 5 and [m.month for m in billable_months(t2, [t1, t2])] == [2, 3]


def test_lines_minimum_top_up_and_first_term_free():
    price = SimpleNamespace(staff_per_month_usd=Decimal("2"), staff_per_month_lrd=Decimal("380"),
                            family_per_month_usd=Decimal("0.50"), family_per_month_lrd=Decimal("95"),
                            term_minimum_usd=Decimal("30"), term_minimum_lrd=Decimal("5700"))
    months = [date(2027, m, 1) for m in range(2, 7)]
    small = term_lines(price, Usage(staff=2, months=months, family_months=4), False)
    assert [(l["kind"], l["quantity"], l["amount_usd"], l["amount_lrd"]) for l in small] == [
        ("staff", 10, Decimal("20.00"), Decimal("3800.00")), ("family", 4, Decimal("2.00"), Decimal("380.00")),
        ("minimum", 1, Decimal("8.00"), Decimal("1520.00"))]
    assert pb.invoice_totals(small) == {"USD": Decimal("30.00"), "LRD": Decimal("5700.00")}
    big = term_lines(price, Usage(staff=5, months=months, family_months=0), False)
    assert [l["kind"] for l in big] == ["staff"]  # above the minimum: no top-up
    free = term_lines(price, Usage(staff=5, months=months, family_months=0), True)
    assert free[-1]["kind"] == "first_term_free" and pb.invoice_totals(free) == {"USD": Decimal("0.00"),
                                                                                  "LRD": Decimal("0.00")}


def test_status_rules_at_30_and_60_days_with_grace_and_dormant():
    due = date(2027, 3, 3)
    assert target_status("active", due, True, None, due + timedelta(days=29))[0] == "active"
    assert target_status("active", due, True, None, due + timedelta(days=30))[0] == "read_only"
    assert target_status("read_only", due, True, None, due + timedelta(days=60))[0] == "suspended"
    assert target_status("suspended", None, True, None, due)[0] == "active"  # paid
    # Grace: no worse until it ends; better is always allowed
    assert target_status("active", due, True, due + timedelta(days=45), due + timedelta(days=40))[0] == "active"
    assert target_status("active", due, True, due + timedelta(days=45), due + timedelta(days=46))[0] == "read_only"
    assert target_status("dormant", due, True, None, due + timedelta(days=90))[0] == "dormant"
    assert target_status("trial", None, False, None, due)[0] == "trial"


# --- usage ---------------------------------------------------------------------------------------------

def test_staff_count_rules(billing_env):
    client, ids = billing_env
    _seed(ids)
    gen, db = _db()
    # admin_a, new_admin_a and the bursar (a school's custom role) are staff; the student, the parent,
    # the inactive teacher and the super-admin living in school A are not
    a = ids["tenant_a"]
    assert BillingService(db).staff_count(a) == 3
    # An account with student and teacher roles is staff
    mixed = db.query(Student).filter(Student.id == ids["student_a"]).one()
    mixed.roles.append(db.query(UserRole).filter(UserRole.name == "teacher").one())
    db.flush()
    assert BillingService(db).staff_count(a) == 4
    assert BillingService(db).staff_count(ids["tenant_b"]) == 1
    next(gen, None)


def test_family_months_come_from_the_previous_term_only(billing_env, clock):
    client, ids = billing_env
    s = _seed(ids)
    _activity(ids, [("student_a", date(2026, 10, 1)), ("student_a", date(2026, 11, 1)), ("parent", date(2026, 12, 1)),
                    ("student_a", date(2027, 1, 1)),   # holiday: free
                    ("student_a", date(2027, 2, 1)),   # this term: billed next term
                    ("admin_a", date(2026, 10, 1)),    # staff are billed as staff
                    ("teacher", date(2026, 11, 1))])
    gen, db = _db()
    db.add(SchoolSubscription(tenant_id=ids["tenant_a"], status="active", first_term_free_used=True))
    next(gen, None)
    clock(date(2027, 2, 1))
    inv = _issue(client, ids, s["a2"])
    lines = {l["kind"]: l for l in inv["lines"]}
    assert lines["family"]["quantity"] == 3 and lines["family"]["amount_usd"] == "1.50"
    assert lines["staff"]["quantity"] == 15  # 3 staff × 5 months (Feb-Jun)
    assert inv["total"] == {"USD": "31.50", "LRD": "5985.00"} and "minimum" not in lines


# --- invoices and payments ------------------------------------------------------------------------------

def test_issue_is_idempotent_and_first_term_is_free(billing_env, clock):
    client, ids = billing_env
    s = _seed(ids)
    clock(date(2026, 9, 1))
    first = _issue(client, ids, s["a1"])
    assert first["created"] is True and first["number"] == "PINV-2026-00001"
    assert [l["kind"] for l in first["lines"]] == ["staff", "minimum", "first_term_free"]
    assert first["total"] == {"USD": "0.00", "LRD": "0.00"} and first["owing"] is False
    again = _issue(client, ids, s["a1"])
    assert again["created"] is False and again["id"] == first["id"]
    assert _job(ids, date(2026, 9, 2))["issued"] is None  # the job finds it too
    status = client.get(f"{B}/status", headers=headers(ids, "admin_a")).json()
    assert status["status"] == "trial" and status["banner"] == "none"

    clock(date(2027, 2, 1))
    second = _job(ids, date(2027, 2, 1))
    assert second["issued"] == "PINV-2027-00001"
    gen, db = _db()
    inv = db.query(PlatformInvoice).filter(PlatformInvoice.number == "PINV-2027-00001").one()
    assert inv.due_date == date(2027, 3, 3)
    assert db.query(SchoolSubscription).filter(SchoolSubscription.tenant_id == ids["tenant_a"]).one().status == "active"
    invoice_id = inv.id
    next(gen, None)
    detail = client.get(f"{SA}/invoices/{invoice_id}", headers=headers(ids, "super")).json()
    assert detail["total"] == {"USD": "30.00", "LRD": "5700.00"}  # staff 3 × 5 months, the minimum exactly
    # Another school's semester is not found; no price list in force is a 409
    assert client.post(f"{SA}/schools/{ids['tenant_a']}/invoices", json={"semester_id": s["b1"]},
                       headers=headers(ids, "super")).status_code == 404


def test_no_price_list_means_no_invoice(billing_env, clock):
    client, ids = billing_env
    s = _seed(ids, prices=False)
    clock(date(2026, 9, 1))
    r = client.post(f"{SA}/schools/{ids['tenant_a']}/invoices", json={"semester_id": s["a1"]}, headers=headers(ids, "super"))
    assert r.status_code == 409
    assert _job(ids, date(2026, 9, 1))["skipped"] == "no price list"


def test_payments_lock_currency_refuse_overpayment_and_void(billing_env, clock):
    client, ids = billing_env
    s = _seed(ids)
    inv = _paid_term(client, ids, s, clock)
    h = headers(ids, "super")
    pay = f"{SA}/invoices/{inv['id']}/payments"
    assert client.post(pay, json={"amount": "30.01", "currency": "USD", "method": "bank"}, headers=h).status_code == 409
    r = client.post(pay, json={"amount": "10", "currency": "USD", "method": "mobile_money", "reference": "MM-1"}, headers=h)
    assert r.status_code == 200, r.text
    first = r.json()
    assert first["receipt_number"] == "PRCPT-2027-00001" and first["balance_now"] == {"USD": "20.00"}
    assert first["amount_in_words"] == "Ten United States dollars" and first["school"]["code"] == "SCA"
    r = client.post(pay, json={"amount": "100", "currency": "LRD", "method": "cash"}, headers=h)
    assert r.status_code == 409 and "USD" in r.json()["detail"]  # the first payment fixed the currency
    assert client.post(pay, json={"amount": "25", "currency": "USD", "method": "cash"}, headers=h).status_code == 409
    second = client.post(pay, json={"amount": "20", "currency": "USD", "method": "cash"}, headers=h).json()
    assert second["receipt_number"] == "PRCPT-2027-00002" and second["balance_now"] == {"USD": "0.00"}
    # An invoice with payments can't be voided; voiding the payments unlocks the currency
    assert client.post(f"{SA}/invoices/{inv['id']}/void", json={"reason": "wrong"}, headers=h).status_code == 409
    for p in (first, second):
        v = client.post(f"{SA}/payments/{p['id']}/void", json={"reason": "bounced"}, headers=h)
        assert v.status_code == 200 and v.json()["voided"] is True
    assert client.post(f"{SA}/payments/{first['id']}/void", json={"reason": "again"}, headers=h).status_code == 409
    detail = client.get(f"{SA}/invoices/{inv['id']}", headers=h).json()
    assert detail["currency"] is None and detail["balance"] == {"USD": "30.00", "LRD": "5700.00"}
    voided = client.post(f"{SA}/invoices/{inv['id']}/void", json={"reason": "wrong prices"}, headers=h)
    assert voided.status_code == 200 and voided.json()["status"] == "void"
    # A void invoice can be issued again (the operator does it; the job leaves it)
    assert _job(ids, date(2027, 2, 2))["issued"] is None
    assert _issue(client, ids, s["a2"])["number"] == "PINV-2027-00002"


def test_voiding_the_free_invoice_gives_the_free_term_back(billing_env, clock):
    client, ids = billing_env
    s = _seed(ids)
    clock(date(2026, 9, 1))
    first = _issue(client, ids, s["a1"])
    client.post(f"{SA}/invoices/{first['id']}/void", json={"reason": "issued early"}, headers=headers(ids, "super"))
    assert _issue(client, ids, s["a1"])["lines"][-1]["kind"] == "first_term_free"


# --- status, reminders, enforcement -------------------------------------------------------------------

def test_status_moves_at_30_and_60_days_and_paying_restores(billing_env, clock):
    client, ids = billing_env
    s = _seed(ids)
    inv = _paid_term(client, ids, s, clock)
    due = date.fromisoformat(inv["due_date"])
    clock(due + timedelta(days=29))
    assert _job(ids, due + timedelta(days=29))["status"] == "active"
    clock(due + timedelta(days=30))
    assert _job(ids, due + timedelta(days=30))["status"] == "read_only"
    clock(due + timedelta(days=60))
    assert _job(ids, due + timedelta(days=60))["status"] == "suspended"
    r = client.post(f"{SA}/invoices/{inv['id']}/payments", json={"amount": "5700", "currency": "LRD", "method": "bank"},
                    headers=headers(ids, "super"))
    assert r.status_code == 200
    assert client.get(f"{B}/status", headers=headers(ids, "admin_a")).json()["status"] == "active"


def test_grace_and_dormant(billing_env, clock):
    client, ids = billing_env
    s = _seed(ids)
    inv = _paid_term(client, ids, s, clock)
    due = date.fromisoformat(inv["due_date"])
    h = headers(ids, "super")
    r = client.put(f"{SA}/schools/{ids['tenant_a']}/subscription", json={"grace_until": str(due + timedelta(days=40))}, headers=h)
    assert r.status_code == 200 and r.json()["grace_until"] == str(due + timedelta(days=40))
    clock(due + timedelta(days=35))
    assert _job(ids, due + timedelta(days=35))["status"] == "active"
    st = client.get(f"{B}/status", headers=headers(ids, "admin_a")).json()
    assert st["banner"] == "overdue" and st["read_only_on"] == str(due + timedelta(days=41))
    clock(due + timedelta(days=41))
    assert _job(ids, due + timedelta(days=41))["status"] == "read_only"
    r = client.put(f"{SA}/schools/{ids['tenant_a']}/subscription", json={"dormant": True}, headers=h)
    assert r.json()["status"] == "dormant"
    clock(due + timedelta(days=90))
    assert _job(ids, due + timedelta(days=90))["status"] == "dormant"  # never moves on its own
    assert client.put(PREFS, json=OFF, headers=headers(ids, "admin_a")).status_code == 403
    r = client.put(f"{SA}/schools/{ids['tenant_a']}/subscription", json={"dormant": False}, headers=h)
    assert r.json()["status"] == "suspended"  # back to what the invoices say


def test_reminders_are_sent_once(billing_env, clock):
    client, ids = billing_env
    s = _seed(ids)
    inv = _paid_term(client, ids, s, clock)
    due = date.fromisoformat(inv["due_date"])
    clock(due)
    assert _job(ids, due)["reminders"] == 1
    assert _job(ids, due)["reminders"] == 0  # same day again: nothing
    clock(due + timedelta(days=20))  # a missed week: due_7 and due_14 together, one alert
    assert _job(ids, due + timedelta(days=20))["reminders"] == 1
    clock(due + timedelta(days=30))
    assert _job(ids, due + timedelta(days=30))["reminders"] == 1  # read-only notice
    assert _job(ids, due + timedelta(days=31))["reminders"] == 0
    gen, db = _db()
    kinds = sorted(r.kind for r in db.query(PlatformReminder).all())
    assert kinds == ["due", "due_14", "due_7", "read_only"]
    alerts = db.query(Notification).filter(Notification.event == "billing_reminder").all()
    # Only the school's admins (admin_a and new_admin_a), three alerts each
    assert {a.user_id for a in alerts} == {ids["admin_a"], ids["new_admin_a"]} and len(alerts) == 6
    assert any("USD 30.00 (or LRD 5,700.00)" in a.body for a in alerts)
    next(gen, None)
    # Paid: nothing more
    client.post(f"{SA}/invoices/{inv['id']}/payments", json={"amount": "30", "currency": "USD", "method": "cash"},
                headers=headers(ids, "super"))
    clock(due + timedelta(days=60))
    assert _job(ids, due + timedelta(days=60)) == {"tenant_id": ids["tenant_a"], "issued": None, "status": "active",
                                                   "reminders": 0}


def test_read_only_refuses_changes_but_allows_reads_and_the_allow_list(billing_env, clock):
    client, ids = billing_env
    s = _seed(ids)
    inv = _paid_term(client, ids, s, clock)
    _set_status(ids, "read_only")
    h = headers(ids, "admin_a")
    r = client.put(PREFS, json=OFF, headers=h)
    assert r.status_code == 403 and r.headers["X-School-Billing-Status"] == "read_only"
    assert "USD 30.00 (or LRD 5,700.00)" in r.json()["detail"]  # admins see the amount
    r = client.put(PREFS, json=OFF, headers=headers(ids, "student_a"))
    assert r.status_code == 403 and r.json()["detail"] == "Your school's account is read-only. Ask the school office."
    assert client.get("/api/v1/finance/categories", headers=h).status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers(ids, "student_a")).status_code == 200
    assert client.post("/api/v1/communication/inbox/read-all", headers=h).status_code == 200
    r = client.post("/api/v1/auth/change-password", json={"current_password": "wrong", "new_password": "x"}, headers=h)
    assert r.status_code == 400  # reached the endpoint
    assert client.get(f"{B}/export", headers=h).status_code == 200
    st = client.get(f"{B}/status", headers=h).json()
    assert st["banner"] == "read_only" and st["amount_due"] == {"USD": "30.00", "LRD": "5700.00"}
    plain = client.get(f"{B}/status", headers=headers(ids, "student_a")).json()
    assert plain["amount_due"] is None and plain["message"] == "Your school's account is read-only. Ask the school office."
    # Platform accounts and other schools are unaffected
    assert client.put(PREFS, json=OFF, headers=headers(ids, "super")).status_code == 200
    assert client.put(PREFS, json=OFF, headers=headers(ids, "admin_b")).status_code == 200
    # Paying restores access at once
    client.post(f"{SA}/invoices/{inv['id']}/payments", json={"amount": "30", "currency": "USD", "method": "bank"},
                headers=headers(ids, "super"))
    assert client.put(PREFS, json=OFF, headers=h).status_code == 200


def test_suspended_lets_only_admins_in_to_pay_and_export(billing_env, clock):
    client, ids = billing_env
    s = _seed(ids)
    _paid_term(client, ids, s, clock)
    _set_status(ids, "suspended")
    admin, student = headers(ids, "admin_a"), headers(ids, "student_a")
    assert client.get("/api/v1/communication/inbox", headers=student).status_code == 403
    assert client.get("/api/v1/auth/me", headers=student).status_code == 403
    assert client.get(f"{B}/status", headers=student).status_code == 200  # the explanation
    assert client.get("/api/v1/auth/me", headers=admin).status_code == 200
    assert client.get(f"{B}/invoices", headers=admin).status_code == 200
    assert client.get(f"{B}/export", headers=admin).status_code == 200
    r = client.get("/api/v1/finance/categories", headers=admin)
    assert r.status_code == 403 and "suspended" in r.json()["detail"] and "USD 30.00" in r.json()["detail"]
    assert client.put(PREFS, json=OFF, headers=admin).status_code == 403
    assert client.get("/api/v1/finance/categories", headers=headers(ids, "super")).status_code == 200
    assert client.get(f"{SA}/summary", headers=headers(ids, "super")).json()["schools"]["suspended"] == 1

    # Sign-in: only admins
    gen, db = _db()
    for who in ("admin_a", "student_a"):
        db.query(Admin if who == "admin_a" else Student).filter_by(id=ids[who]).one().password_hash = get_password_hash(PASSWORD)
    emails = {who: db.query(Admin if who == "admin_a" else Student).filter_by(id=ids[who]).one().email
              for who in ("admin_a", "student_a")}
    next(gen, None)
    school = {"X-Tenant-ID": str(ids["tenant_a"])}
    r = client.post("/api/v1/auth/login", data={"username": emails["student_a"], "password": PASSWORD}, headers=school)
    assert r.status_code == 403 and r.headers["X-School-Billing-Status"] == "suspended"
    assert client.post("/api/v1/auth/login", data={"username": emails["admin_a"], "password": PASSWORD},
                       headers=school).status_code == 200
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": headers(ids, "student_a", token_type="refresh")
                                                  ["Authorization"].split()[1]})
    assert r.status_code == 403


def test_usage_is_recorded_once_per_month_at_sign_in(billing_env, clock):
    client, ids = billing_env
    _seed(ids)
    gen, db = _db()
    user = db.query(Student).filter_by(id=ids["student_a"]).one()
    user.password_hash = get_password_hash(PASSWORD)
    email = user.email
    next(gen, None)
    school = {"X-Tenant-ID": str(ids["tenant_a"])}
    clock(date(2027, 2, 3))
    for _ in range(2):
        assert client.post("/api/v1/auth/login", data={"username": email, "password": PASSWORD},
                           headers=school).status_code == 200
    # Refreshing the session in the same month adds nothing either
    refresh = headers(ids, "student_a", token_type="refresh")["Authorization"].split()[1]
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": refresh}).status_code == 200
    clock(date(2027, 3, 1))
    assert client.post("/api/v1/auth/login", data={"username": email, "password": PASSWORD},
                       headers=school).status_code == 200
    gen, db = _db()
    months = sorted(m for (m,) in db.query(UserActivityMonth.month).filter_by(user_id=ids["student_a"]))
    assert months == [date(2027, 2, 1), date(2027, 3, 1)]
    next(gen, None)


def test_recording_usage_never_fails_sign_in(billing_env, monkeypatch):
    client, ids = billing_env
    gen, db = _db()
    user = db.query(Student).filter_by(id=ids["student_a"]).one()
    user.password_hash = get_password_hash(PASSWORD)
    email = user.email
    next(gen, None)

    def broken(*args, **kwargs):
        raise RuntimeError("database trouble")
    monkeypatch.setattr(pb, "today", broken)
    assert client.post("/api/v1/auth/login", data={"username": email, "password": PASSWORD},
                       headers={"X-Tenant-ID": str(ids["tenant_a"])}).status_code == 200


# --- the school's endpoints ---------------------------------------------------------------------------

def test_school_endpoints_are_isolated_and_admin_only(billing_env, clock):
    client, ids = billing_env
    s = _seed(ids)
    inv = _paid_term(client, ids, s, clock)
    receipt = client.post(f"{SA}/invoices/{inv['id']}/payments", json={"amount": "10", "currency": "USD", "method": "cash"},
                          headers=headers(ids, "super")).json()
    a, b = headers(ids, "admin_a"), headers(ids, "admin_b")
    mine = client.get(f"{B}/invoices", headers=a).json()
    assert [i["number"] for i in mine] == ["PINV-2027-00001", "PINV-2026-00001"]
    assert client.get(f"{B}/invoices/{inv['id']}", headers=a).json()["lines"][0]["kind"] == "staff"
    r = client.get(f"{B}/payments/{receipt['id']}/receipt", headers=a)
    assert r.status_code == 200 and r.json()["receipt_number"] == "PRCPT-2027-00001"
    # School B sees none of it
    assert client.get(f"{B}/invoices", headers=b).json() == []
    assert client.get(f"{B}/invoices/{inv['id']}", headers=b).status_code == 404
    assert client.get(f"{B}/payments/{receipt['id']}/receipt", headers=b).status_code == 404
    assert client.get(f"{B}/status", headers=b).json()["amount_due"] == {}
    # Staff who aren't admins get the status only
    assert client.get(f"{B}/invoices", headers=headers(ids, "student_a")).status_code == 403
    assert client.get(f"{B}/export", headers=headers(ids, "student_a")).status_code == 403
    # Platform routes are for the operator only
    assert client.get(f"{SA}/schools", headers=a).status_code == 403
    listing = client.get(f"{SA}/schools", params={"q": "school a"}, headers=headers(ids, "super")).json()
    row = listing["items"][0]
    assert listing["total"] == 1 and row["amount_due"] == {"USD": "20.00"} and row["staff_count"] == 3
    assert row["last_term_name"] == "Semester 1"


def test_export_contains_only_the_schools_data(billing_env, clock):
    client, ids = billing_env
    _seed(ids)
    r = client.get(f"{B}/export", headers=headers(ids, "admin_a"))
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    z = zipfile.ZipFile(io.BytesIO(r.content))
    assert sorted(z.namelist()) == ["enrollments.csv", "fee_payments.csv", "guardians.csv", "results.csv", "students.csv"]
    students = list(csv.DictReader(io.StringIO(z.read("students.csv").decode("utf-8-sig"))))
    assert [s["admission_number"] for s in students] == ["A1"]  # not school B's B1
    guardians = list(csv.DictReader(io.StringIO(z.read("guardians.csv").decode("utf-8-sig"))))
    assert [g["guardian_id"] for g in guardians] == [str(ids["parent"])]


def test_prices_and_webhook(billing_env, clock):
    client, ids = billing_env
    h = headers(ids, "super")
    body = {"effective_from": "2027-01-01", "staff_per_month_usd": "2.50", "staff_per_month_lrd": "475",
            "family_per_month_usd": "0.5", "family_per_month_lrd": 95, "term_minimum_usd": "30",
            "term_minimum_lrd": "5700"}
    r = client.post(f"{SA}/prices", json=body, headers=h)
    assert r.status_code == 200 and r.json()["staff_per_month_usd"] == "2.50" and r.json()["in_force"] is True
    assert client.post(f"{SA}/prices", json=body, headers=h).status_code == 409
    assert client.post(f"{SA}/prices", json={**body, "effective_from": "2027-06-01", "term_minimum_usd": "1.234"},
                       headers=h).status_code == 422
    assert client.get(f"{SA}/prices", headers=headers(ids, "admin_a")).status_code == 403
    # No provider is configured: the public webhook answers 404
    assert client.post(f"{SA}/payments/webhook/flutterwave", content=b"{}").status_code == 404


def test_platform_dashboards_read_billing(billing_env, clock):
    client, ids = billing_env
    s = _seed(ids)
    inv = _paid_term(client, ids, s, clock)
    h = headers(ids, "super")
    client.post(f"{SA}/invoices/{inv['id']}/payments", json={"amount": "10", "currency": "USD", "method": "cash"}, headers=h)
    metrics = client.get("/api/v1/super-admin/dashboard/system-metrics", headers=h).json()["revenue_metrics"]
    assert metrics["collected"] == {"USD": "10.00"} and metrics["outstanding"] == {"USD": "20.00"}
    rows = {r["tenant_name"]: r for r in client.get("/api/v1/super-admin/dashboard/revenue-by-tenant", headers=h).json()}
    assert rows["School A"]["amount_due"] == {"USD": "20.00"} and rows["School B"]["billing_status"] == "trial"
    recent = client.get("/api/v1/super-admin/dashboard/recent-tenants", headers=h).json()
    assert {r["billing_status"] for r in recent} == {"active", "trial"} and "plan_type" not in recent[0]
    assert client.get("/api/v1/super-admin/analytics/growth-forecast", headers=h).status_code == 200
    assert client.get("/api/v1/super-admin/analytics/churn-risk", headers=h).status_code == 200


def test_payment_details_written_by_the_operator_shown_to_school_admins(env):
    """How to pay: empty until the operator writes it; school admins read it, others can't."""
    from src.db.session import get_super_admin_db
    client, ids = env
    main.app.dependency_overrides[get_super_admin_db] = main.app.dependency_overrides[get_db]
    school = "/api/v1/billing/payment-details"
    platform = "/api/v1/super-admin/billing/payment-details"
    assert client.get(school, headers=headers(ids, "admin_a")).json()["instructions"] is None
    text = "Bank: LBDI 001-234-567 (Top Foundation SaaS)\nMTN MoMo: 0886 000 000"
    r = client.put(platform, json={"instructions": f"  {text}  "}, headers=headers(ids, "super"))
    assert r.status_code == 200 and r.json()["instructions"] == text
    assert client.get(school, headers=headers(ids, "admin_b")).json()["instructions"] == text
    assert client.get(school, headers=headers(ids, "student_a")).status_code == 403
    assert client.put(platform, json={"instructions": "x"}, headers=headers(ids, "admin_a")).status_code == 403
    assert client.put(platform, json={"instructions": "x" * 2001}, headers=headers(ids, "super")).status_code == 422
    client.put(platform, json={"instructions": "  "}, headers=headers(ids, "super"))
    assert client.get(school, headers=headers(ids, "admin_a")).json()["instructions"] is None

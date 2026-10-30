"""Phase 5 fees: schedules, invoices, currency lock, receipts, allocation, overdue, adjustments,
voids, the family view, the report-card hold, the accounts list and the reports."""
from datetime import date, datetime, UTC
from decimal import Decimal

import pytest
from sqlalchemy.dialects import postgresql

import main
from src.db.models.academics.academic_grade import AcademicGrade
from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.class_model import Class
from src.db.models.academics.enrollment import Enrollment
from src.db.models.academics.section import Section
from src.db.models.academics.semester import Semester
from src.db.models.auth.admin import Admin
from src.db.models.auth.permission import Permission
from src.db.models.auth.user_role import UserRole
from src.db.models.finance.fees import ReceiptCounter, StudentFeeAccount
from src.db.models.people.parent import Parent, parent_student
from src.db.models.people.student import Student
from src.db.models.tenant.tenant_settings import TenantSettings
from src.db.session import get_db
from src.services.finance import fee_service, ledger
from src.services.finance.fee_service import FeeService, amount_in_words

from test_security import env, headers  # noqa: F401  shared app + two-school fixture

F = "/api/v1/finance"
FINANCE_PERMS = ("view_financial_data", "manage_financial_data", "create_invoices", "record_payments",
                 "approve_financial_transactions", "generate_financial_reports",
                 "view_academic_data")  # the last: admins read report cards as staff


@pytest.fixture
def clock(monkeypatch):
    """Fix "now" (UTC; the school's default zone, Africa/Monrovia, is UTC+0)."""
    state = {"now": datetime(2026, 11, 1, 10, 0, tzinfo=UTC)}
    monkeypatch.setattr(fee_service, "_now", lambda: state["now"])

    def set_now(*args):
        state["now"] = datetime(*args, tzinfo=UTC)
    return set_now


def _db():
    gen = main.app.dependency_overrides[get_db]()
    return gen, next(gen)


def _seed(ids):
    """School A: a 2026/2027 year with two semesters; Grade 1 (class 1A, three pupils) and Grade 2
    (class 2A, one pupil); a cashier, a second cashier, a principal, a parent of pupil 0."""
    gen, db = _db()
    a = ids["tenant_a"]
    perms = {}
    for name in FINANCE_PERMS:
        perms[name] = db.query(Permission).filter(Permission.name == name).first() or Permission(name=name)
        db.add(perms[name])
    admin_role = db.query(UserRole).filter(UserRole.name == "admin").one()
    admin_role.permissions = list({*admin_role.permissions, *perms.values()})
    cashier_role = UserRole(name="cashier")
    cashier_role.permissions = [perms["view_financial_data"], perms["record_payments"]]
    principal_role = UserRole(name="principal")
    principal_role.permissions = [perms["view_financial_data"], perms["record_payments"],
                                  perms["approve_financial_transactions"]]
    parent_role = UserRole(name="parent")
    student_role = db.query(UserRole).filter(UserRole.name == "student").one()
    db.add_all([cashier_role, principal_role, parent_role])

    start, end = date(2026, 9, 1), date(2027, 6, 30)
    year = AcademicYear(tenant_id=a, name="2026/2027", start_date=start, end_date=end, is_current=True,
                        semester_1_start=start, semester_1_end=date(2027, 1, 31),
                        semester_2_start=date(2027, 2, 1), semester_2_end=end)
    g1 = AcademicGrade(tenant_id=a, name="Grade 1", sequence=1, is_active=True)
    g2 = AcademicGrade(tenant_id=a, name="Grade 2", sequence=2, is_active=True)
    db.add_all([year, g1, g2])
    db.flush()
    s1 = Section(tenant_id=a, name="A", grade_id=g1.id, capacity=30, is_active=True)
    s2 = Section(tenant_id=a, name="A", grade_id=g2.id, capacity=30, is_active=True)
    sem1 = Semester(tenant_id=a, academic_year_id=year.id, name="Semester 1", semester_number=1,
                    start_date=start, end_date=date(2027, 1, 31))
    sem2 = Semester(tenant_id=a, academic_year_id=year.id, name="Semester 2", semester_number=2,
                    start_date=date(2027, 2, 1), end_date=end)
    db.add_all([s1, s2, sem1, sem2])
    db.flush()
    c1 = Class(tenant_id=a, name="Grade 1 - A", academic_year_id=year.id, grade_id=g1.id, section_id=s1.id,
               capacity=30, start_date=start, is_active=True)
    c2 = Class(tenant_id=a, name="Grade 2 - A", academic_year_id=year.id, grade_id=g2.id, section_id=s2.id,
               capacity=30, start_date=start, is_active=True)
    db.add_all([c1, c2])
    db.flush()

    n = iter(range(100))

    def person(cls, role, **extra):
        i = next(n)
        u = cls(tenant_id=a, email=f"f{i}@school-a.org", password_hash="x", first_name=f"First{i}",
                last_name=f"Last{i:02d}", is_first_login=False, **extra)
        u.roles.append(role)
        db.add(u)
        return u

    pupils = [person(Student, student_role, admission_number=f"P{i}") for i in range(4)]
    cashier = person(Admin, cashier_role)
    cashier2 = person(Admin, cashier_role)
    principal = person(Admin, principal_role)
    parent = person(Parent, parent_role, relationship_type="mother")
    db.flush()
    parent.students.append(pupils[0])
    for i, p in enumerate(pupils):
        cls = c1 if i < 3 else c2
        db.add(Enrollment(tenant_id=a, student_id=p.id, academic_year_id=year.id, grade_id=cls.grade_id,
                          section_id=cls.section_id, class_id=cls.id, status="active", is_active=True))
    db.flush()
    out = {"year": str(year.id), "sem1": str(sem1.id), "sem2": str(sem2.id), "g1": str(g1.id), "g2": str(g2.id),
           "c1": str(c1.id), "c2": str(c2.id), "pupils": [str(p.id) for p in pupils]}
    ids.update(cashier=cashier.id, cashier2=cashier2.id, principal=principal.id, parent=parent.id,
               pupil0=pupils[0].id, pupil1=pupils[1].id, pupil3=pupils[3].id)
    next(gen, None)
    return out


def _setup(client, ids, s, plan=True, sem2=False):
    """Tuition for every grade (USD 100 / LRD 18,000) and a Grade 1 lab fee (USD 50 / LRD 9,000) in
    semester 1; plan 50% by 15 Oct, 50% by 15 Dec; invoices issued."""
    h = headers(ids, "admin_a")
    tuition = client.post(f"{F}/categories", json={"name": "Tuition"}, headers=h).json()
    lab = client.post(f"{F}/categories", json={"name": "Lab"}, headers=h).json()
    r = client.post(f"{F}/schedules", json={"academic_year_id": s["year"], "semester_id": s["sem1"],
                                            "category_id": tuition["id"], "amount_usd": "100", "amount_lrd": "18000"},
                    headers=h)
    assert r.status_code == 200, r.text
    r = client.post(f"{F}/schedules", json={"academic_year_id": s["year"], "semester_id": s["sem1"], "grade_id": s["g1"],
                                            "category_id": lab["id"], "amount_usd": 50, "amount_lrd": 9000}, headers=h)
    assert r.status_code == 200, r.text
    if plan:
        r = client.put(f"{F}/installment-plans", params={"semester_id": s["sem1"], "academic_year_id": s["year"]},
                       json=[{"due_date": "2026-12-15", "percent": 50}, {"due_date": "2026-10-15", "percent": "50"}],
                       headers=h)
        assert r.status_code == 200, r.text
        assert [i["due_date"] for i in r.json()["installments"]] == ["2026-10-15", "2026-12-15"]
    if sem2:
        r = client.post(f"{F}/schedules", json={"academic_year_id": s["year"], "semester_id": s["sem2"],
                                                "category_id": tuition["id"], "amount_usd": "100", "amount_lrd": "18000"},
                        headers=h)
        assert r.status_code == 200, r.text
    r = client.post(f"{F}/invoices/issue", json={"academic_year_id": s["year"], "semester_id": s["sem1"]}, headers=h)
    assert r.status_code == 200, r.text
    if sem2:
        r2 = client.post(f"{F}/invoices/issue", json={"academic_year_id": s["year"], "semester_id": s["sem2"]}, headers=h)
        assert r2.status_code == 200, r2.text
    return {"tuition": tuition["id"], "lab": lab["id"], "issue": r.json()}


def _pay(client, ids, s, who="cashier", pupil=0, amount="50", currency="USD", method="cash"):
    return client.post(f"{F}/payments", json={"student_id": s["pupils"][pupil], "academic_year_id": s["year"],
                                              "amount": amount, "currency": currency, "method": method},
                       headers=headers(ids, who))


def _statement(client, ids, s, pupil=0, who="admin_a"):
    r = client.get(f"{F}/accounts/{s['pupils'][pupil]}", headers=headers(ids, who))
    assert r.status_code == 200, r.text
    return r.json()


# --- pure arithmetic --------------------------------------------------------------------------------

def test_ledger_overdue_and_allocation():
    inv = ledger.InvoiceCalc(lines=[ledger.Line(Decimal("150"), None)], paid=Decimal("40"),
                             plan=[ledger.Installment(1, date(2026, 10, 15), Decimal(50)),
                                   ledger.Installment(2, date(2026, 12, 15), Decimal(50))])
    assert inv.overdue("USD", "USD", date(2026, 10, 15)) == 0       # on the due date: not yet overdue
    assert inv.overdue("USD", "USD", date(2026, 10, 16)) == Decimal("35.00")
    assert inv.overdue("USD", "USD", date(2026, 12, 16)) == Decimal("110.00")
    assert inv.owed("LRD") is None and inv.currencies() == ["USD"]
    assert ledger.allocate(Decimal("120"), [("a", Decimal("100")), ("b", Decimal("50"))]) == \
        [("a", Decimal("100.00")), ("b", Decimal("20.00"))]
    assert amount_in_words(Decimal("1250.05"), "LRD") == "One thousand two hundred and fifty Liberian dollars and five cents"


# --- setup and invoices -------------------------------------------------------------------------------

def test_schedules_plans_and_idempotent_issue(env, clock):
    client, ids = env
    s = _seed(ids)
    made = _setup(client, ids, s)
    h = headers(ids, "admin_a")
    # 4 students; Grade 1 pupils get tuition + lab, the Grade 2 pupil tuition only
    assert made["issue"]["students"] == 4 and made["issue"]["invoices_created"] == 4
    assert made["issue"]["lines_added"] == 7
    again = client.post(f"{F}/invoices/issue", json={"academic_year_id": s["year"], "semester_id": s["sem1"]}, headers=h).json()
    assert again["invoices_created"] == 0 and again["lines_added"] == 0 and again["unchanged"] == 4

    # a new fee for Grade 2 only: added to the existing invoice, once
    books = client.post(f"{F}/categories", json={"name": "Books"}, headers=h).json()
    client.post(f"{F}/schedules", json={"academic_year_id": s["year"], "semester_id": s["sem1"], "grade_id": s["g2"],
                                        "category_id": books["id"], "amount_usd": "20", "amount_lrd": "3600"}, headers=h)
    third = client.post(f"{F}/invoices/issue", json={"academic_year_id": s["year"], "semester_id": s["sem1"],
                                                     "class_id": s["c2"]}, headers=h).json()
    assert third["students"] == 1 and third["invoices_updated"] == 1 and third["lines_added"] == 1

    st = _statement(client, ids, s, pupil=3)
    assert st["owed"] == {"USD": "120.00", "LRD": "21600.00"}
    assert st["account"]["currency"] is None and st["account"]["academic_year_name"] == "2026/2027"
    assert st["invoices"][0]["semester_name"] == "Semester 1" and len(st["invoices"][0]["lines"]) == 2

    schedules = client.get(f"{F}/schedules", params={"academic_year_id": s["year"], "semester_id": s["sem1"]}, headers=h).json()
    assert len(schedules) == 3 and all(x["invoiced"] for x in schedules)
    assert schedules[0]["grade_id"] is None and schedules[0]["amount_usd"] == "100.00"
    # duplicates, invoiced schedules and used categories are protected
    dup = client.post(f"{F}/schedules", json={"academic_year_id": s["year"], "semester_id": s["sem1"],
                                              "category_id": made["tuition"], "amount_usd": "1"}, headers=h)
    assert dup.status_code == 409
    assert client.delete(f"{F}/schedules/{schedules[0]['id']}", headers=h).status_code == 409
    assert client.delete(f"{F}/categories/{made['tuition']}", headers=h).status_code == 409
    bad_plan = client.put(f"{F}/installment-plans", params={"semester_id": s["sem2"]},
                          json=[{"due_date": "2027-03-01", "percent": 60}], headers=h)
    assert bad_plan.status_code == 422
    no_amount = client.post(f"{F}/schedules", json={"academic_year_id": s["year"], "semester_id": s["sem2"],
                                                    "category_id": made["tuition"]}, headers=h)
    assert no_amount.status_code == 422
    # a cashier can't change the setup
    assert client.post(f"{F}/categories", json={"name": "X"}, headers=headers(ids, "cashier")).status_code == 403


# --- payments ------------------------------------------------------------------------------------------

def test_currency_is_fixed_by_the_first_payment(env, clock):
    client, ids = env
    s = _seed(ids)
    _setup(client, ids, s)
    before = _statement(client, ids, s)
    assert before["currencies"] == ["USD", "LRD"] and before["balance"] == {"USD": "150.00", "LRD": "27000.00"}

    r = _pay(client, ids, s, amount="50")
    assert r.status_code == 200, r.text
    after = _statement(client, ids, s)
    assert after["account"]["currency"] == "USD" and after["account"]["currency_locked_at"]
    assert after["currencies"] == ["USD"] and after["balance"] == {"USD": "100.00"}
    refused = _pay(client, ids, s, amount="1000", currency="LRD")
    assert refused.status_code == 409 and "pays in USD" in refused.json()["detail"]

    # resetting the currency needs approve and no valid payments
    reset = f"{F}/accounts/{s['pupils'][0]}/reset-currency"
    assert client.post(reset, params={"academic_year_id": s["year"]}, headers=headers(ids, "cashier")).status_code == 403
    assert client.post(reset, params={"academic_year_id": s["year"]}, headers=headers(ids, "principal")).status_code == 409
    client.post(f"{F}/payments/{r.json()['id']}/void", json={"reason": "wrong currency"}, headers=headers(ids, "cashier"))
    ok = client.post(reset, params={"academic_year_id": s["year"]}, headers=headers(ids, "principal"))
    assert ok.status_code == 200 and ok.json()["account"]["currency"] is None
    assert _pay(client, ids, s, amount="1000", currency="LRD").status_code == 200


def test_receipts_are_numbered_per_school_year_and_never_reused(env, clock):
    client, ids = env
    s = _seed(ids)
    _setup(client, ids, s)
    first = _pay(client, ids, s, pupil=0, amount="10").json()
    second = _pay(client, ids, s, pupil=1, amount="20.50").json()
    assert (first["receipt_number"], second["receipt_number"]) == ("2026-00001", "2026-00002")
    assert second["amount"] == "20.50" and second["amount_in_words"].endswith("and fifty cents")
    assert second["student_name"] and second["academic_year_name"] == "2026/2027"
    assert second["balance_after"] == {"USD": "129.50"} and second["can_void"] is True
    client.post(f"{F}/payments/{first['id']}/void", json={"reason": "typo"}, headers=headers(ids, "cashier"))
    voided = client.get(f"{F}/payments/{first['id']}", headers=headers(ids, "admin_a")).json()
    assert voided["receipt_number"] == "2026-00001" and voided["voided_at"] and voided["void_reason"] == "typo"
    third = _pay(client, ids, s, pupil=0, amount="5").json()
    assert third["receipt_number"] == "2026-00003"  # the voided number is not reused

    gen, db = _db()
    counter = db.query(ReceiptCounter).filter(ReceiptCounter.tenant_id == ids["tenant_a"]).one()
    assert (counter.year, counter.last_number) == (2026, 3)
    next(gen, None)


def test_numbering_and_payment_lock_rows_for_update(env):
    """The counter and the student's account are read with SELECT ... FOR UPDATE (PostgreSQL), so
    concurrent cashiers wait for each other instead of reusing numbers or overpaying."""
    client, ids = env
    gen, db = _db()
    service = FeeService(db, ids["tenant_a"], None)
    sql = str(service._counter_query(2026).compile(dialect=postgresql.dialect()))
    assert "FROM receipt_counters" in sql and sql.rstrip().endswith("FOR UPDATE")
    account_sql = str(service._account_query(ids["student_a"], ids["tenant_a"], lock=True)
                      .statement.compile(dialect=postgresql.dialect()))
    assert "FROM student_fee_accounts" in account_sql and account_sql.rstrip().endswith("FOR UPDATE")
    next(gen, None)


def test_overpayment_is_refused(env, clock):
    client, ids = env
    s = _seed(ids)
    _setup(client, ids, s)
    r = _pay(client, ids, s, amount="150.01")
    assert r.status_code == 409 and r.json()["detail"] == "Balance is USD 150.00"
    assert _pay(client, ids, s, amount="150").status_code == 200
    assert _pay(client, ids, s, amount="0.01").json()["detail"] == "Balance is USD 0.00"
    assert _pay(client, ids, s, amount="1.234").status_code == 422
    assert _pay(client, ids, s, amount="5", who="admin_b").status_code == 404  # another school


def test_payment_is_allocated_oldest_semester_first(env, clock):
    client, ids = env
    s = _seed(ids)
    _setup(client, ids, s, sem2=True)
    r = _pay(client, ids, s, amount="200").json()
    assert [(a["semester_name"], a["amount"]) for a in r["allocations"]] == [("Semester 1", "150.00"), ("Semester 2", "50.00")]
    st = _statement(client, ids, s)
    assert [i["balance"] for i in st["invoices"]] == [{"USD": "0.00"}, {"USD": "50.00"}]


def test_balances_and_overdue_follow_installment_due_dates(env, clock):
    client, ids = env
    s = _seed(ids)
    _setup(client, ids, s)
    clock(2026, 10, 15, 12)
    assert _statement(client, ids, s)["overdue"] == {"USD": "0.00", "LRD": "0.00"}
    clock(2026, 10, 16, 9)
    st = _statement(client, ids, s)
    assert st["overdue"] == {"USD": "75.00", "LRD": "13500.00"}
    assert [i["status"] for i in st["installments"]] == ["overdue", "due"]
    assert st["installments"][0]["amount_due"] == st["installments"][0]["due"] == {"USD": "75.00", "LRD": "13500.00"}
    _pay(client, ids, s, amount="80")
    st = _statement(client, ids, s)
    assert st["overdue"] == {"USD": "0.00"} and st["balance"] == {"USD": "70.00"}
    assert st["installments"][1]["outstanding"] == {"USD": "70.00"}
    clock(2026, 12, 16, 9)
    assert _statement(client, ids, s)["overdue"] == {"USD": "70.00"}


def test_adjustments_need_approval(env, clock):
    client, ids = env
    s = _seed(ids)
    _setup(client, ids, s)
    inv = _statement(client, ids, s)["invoices"][0]["id"]
    url = f"{F}/invoices/{inv}/adjustments"
    body = {"kind": "discount", "percent": 10, "reason": "Sibling"}
    assert client.post(url, json=body, headers=headers(ids, "cashier")).status_code == 403
    r = client.post(url, json=body, headers=headers(ids, "principal"))
    assert r.status_code == 200, r.text
    assert r.json()["owed"] == {"USD": "135.00", "LRD": "24300.00"}
    # before the currency is fixed, a fixed amount needs both currencies
    one = client.post(url, json={"kind": "waiver", "amount_usd": "15", "reason": "x"}, headers=headers(ids, "principal"))
    assert one.status_code == 422
    both = client.post(url, json={"kind": "scholarship", "amount_usd": "15", "amount_lrd": "2700", "reason": "x"},
                       headers=headers(ids, "principal"))
    assert both.json()["owed"] == {"USD": "120.00", "LRD": "21600.00"}
    adj = both.json()["invoices"][0]["adjustments"]
    assert [a["kind"] for a in adj] == ["discount", "scholarship"] and adj[0]["approved_by_name"]
    too_much = client.post(url, json={"kind": "waiver", "percent": 95, "reason": "x"}, headers=headers(ids, "principal"))
    assert too_much.status_code == 409
    assert client.delete(f"{F}/adjustments/{adj[1]['id']}", headers=headers(ids, "cashier")).status_code == 403
    back = client.delete(f"{F}/adjustments/{adj[1]['id']}", headers=headers(ids, "principal"))
    assert back.json()["owed"] == {"USD": "135.00", "LRD": "24300.00"}


def test_voids(env, clock):
    client, ids = env
    s = _seed(ids)
    _setup(client, ids, s)
    first = _pay(client, ids, s, amount="40").json()
    # another cashier can't void it; the recorder can, the same school day
    assert client.post(f"{F}/payments/{first['id']}/void", json={"reason": "x"},
                       headers=headers(ids, "cashier2")).status_code == 403
    clock(2026, 11, 1, 23, 59)
    r = client.post(f"{F}/payments/{first['id']}/void", json={"reason": "Wrong student"}, headers=headers(ids, "cashier"))
    assert r.status_code == 200, r.text
    # the receipt keeps the balance as it stood after the payment; balance_now reflects the void
    assert r.json()["voided_at"] and r.json()["balance_after"] == {"USD": "110.00"} and r.json()["can_void"] is False
    assert r.json()["balance_now"] == {"USD": "150.00"}
    assert client.post(f"{F}/payments/{first['id']}/void", json={"reason": "x"},
                       headers=headers(ids, "principal")).status_code == 409
    second = _pay(client, ids, s, amount="60").json()
    clock(2026, 11, 2, 0, 1)  # next day
    assert client.post(f"{F}/payments/{second['id']}/void", json={"reason": "x"},
                       headers=headers(ids, "cashier")).status_code == 403
    ok = client.post(f"{F}/payments/{second['id']}/void", json={"reason": "Bounced"}, headers=headers(ids, "principal"))
    assert ok.status_code == 200 and ok.json()["balance_after"] == {"USD": "90.00"} and ok.json()["balance_now"] == {"USD": "150.00"}
    st = _statement(client, ids, s)
    assert [p["receipt_number"] for p in st["payments"]] == ["2026-00001", "2026-00002"]
    assert all(p["voided_at"] for p in st["payments"]) and st["paid"] == {"USD": "0.00"}
    listed = client.get(f"{F}/payments", params={"status": "void"}, headers=headers(ids, "admin_a")).json()
    assert listed["total"] == 2 and listed["totals"] == {}


def test_invoice_void_is_refused_while_payments_are_allocated(env, clock):
    client, ids = env
    s = _seed(ids)
    _setup(client, ids, s)
    inv = _statement(client, ids, s)["invoices"][0]["id"]
    pay = _pay(client, ids, s, amount="10").json()
    assert client.post(f"{F}/invoices/{inv}/void", json={"reason": "x"}, headers=headers(ids, "principal")).status_code == 409
    client.post(f"{F}/payments/{pay['id']}/void", json={"reason": "x"}, headers=headers(ids, "principal"))
    r = client.post(f"{F}/invoices/{inv}/void", json={"reason": "Left the school"}, headers=headers(ids, "principal"))
    assert r.status_code == 200 and r.json()["invoices"][0]["status"] == "void" and r.json()["owed"] == {"USD": "0.00"}


# --- family -------------------------------------------------------------------------------------------

def test_family_sees_only_their_own(env, clock):
    client, ids = env
    s = _seed(ids)
    _setup(client, ids, s)
    pay = _pay(client, ids, s, pupil=0, amount="30").json()
    other = _pay(client, ids, s, pupil=1, amount="30").json()

    kids = client.get(f"{F}/family/students", headers=headers(ids, "parent"))
    assert kids.status_code == 200, kids.text
    assert [k["student_id"] for k in kids.json()] == [s["pupils"][0]]
    k = kids.json()[0]
    assert k["currency"] == "USD" and k["balance"] == {"USD": "120.00"} and k["report_cards_held"] is False
    assert k["next_due"] == {"due_date": "2026-12-15", "amount": {"USD": "75.00"}}
    assert k["overdue"] == {"USD": "45.00"}

    st = client.get(f"{F}/family/accounts/{s['pupils'][0]}", headers=headers(ids, "parent"))
    assert st.status_code == 200 and set(st.json()["account"]) == {"currency", "currency_locked_at"}
    assert set(st.json()["payments"][0]) == set(fee_service.FAMILY_PAYMENT_FIELDS)
    assert client.get(f"{F}/family/accounts/{s['pupils'][1]}", headers=headers(ids, "parent")).status_code == 403
    assert client.get(f"{F}/family/accounts/{ids['student_b']}", headers=headers(ids, "parent")).status_code == 404
    receipt = client.get(f"{F}/family/payments/{pay['id']}", headers=headers(ids, "parent"))
    assert receipt.status_code == 200 and receipt.json()["student"]["admission_number"] == "P0"
    assert receipt.json()["received_by_name"] and receipt.json()["balance_after"] == {"USD": "120.00"}
    assert client.get(f"{F}/family/payments/{other['id']}", headers=headers(ids, "parent")).status_code == 404

    me = client.get(f"{F}/family/students", headers=headers(ids, "pupil1"))
    assert [x["student_id"] for x in me.json()] == [s["pupils"][1]]
    assert client.get(f"{F}/family/accounts/{s['pupils'][1]}", headers=headers(ids, "pupil1")).status_code == 200
    assert client.get(f"{F}/family/accounts/{s['pupils'][0]}", headers=headers(ids, "pupil1")).status_code == 403
    assert client.get(f"{F}/family/payments/{pay['id']}", headers=headers(ids, "pupil1")).status_code == 404
    # staff pages stay closed to families; school B's student sees nothing of school A
    assert client.get(f"{F}/accounts", headers=headers(ids, "parent")).status_code == 403
    assert client.get(f"{F}/family/payments/{pay['id']}", headers=headers(ids, "student_b")).status_code == 404
    assert client.get(f"{F}/family/students", headers=headers(ids, "cashier")).status_code == 403


def test_report_card_hold(env, clock):
    client, ids = env
    s = _seed(ids)
    _setup(client, ids, s)
    url = f"/api/v1/academics/gradebook/report-cards/students/{s['pupils'][0]}"
    clock(2026, 10, 20, 9)  # first installment overdue
    assert client.get(url, headers=headers(ids, "parent")).status_code == 200  # setting off by default

    h = headers(ids, "admin_a")
    assert client.put(f"{F}/settings", json={"hold_report_cards_on_arrears": True},
                      headers=headers(ids, "cashier")).status_code == 403
    r = client.put(f"{F}/settings", json={"hold_report_cards_on_arrears": True}, headers=h)
    assert r.json() == {"hold_report_cards_on_arrears": True, "school_today": "2026-10-20"}
    held = client.get(url, headers=headers(ids, "parent"))
    assert held.status_code == 403 and held.json()["detail"] == fee_service.HOLD_MESSAGE
    assert client.get(url, headers=headers(ids, "pupil0")).status_code == 403
    assert client.get(url, headers=h).status_code == 200  # staff always
    assert client.get(f"{F}/family/students", headers=headers(ids, "parent")).json()[0]["report_cards_held"] is True

    # a per-student override (approve) lets the family see it again
    hold = f"{F}/accounts/{s['pupils'][0]}/report-card-hold"
    assert client.put(hold, params={"academic_year_id": s["year"]}, json={"override": True},
                      headers=headers(ids, "cashier")).status_code == 403
    ov = client.put(hold, params={"academic_year_id": s["year"]}, json={"override": True}, headers=headers(ids, "principal"))
    assert ov.status_code == 200 and ov.json()["account"]["report_card_hold_override"] is True
    assert client.get(url, headers=headers(ids, "parent")).status_code == 200
    client.put(hold, params={"academic_year_id": s["year"]}, json={"override": False}, headers=headers(ids, "principal"))
    assert client.get(url, headers=headers(ids, "parent")).status_code == 403
    # paying what is overdue lifts the hold
    _pay(client, ids, s, amount="75")
    assert client.get(url, headers=headers(ids, "parent")).status_code == 200


def test_finance_switched_off(env, clock):
    """With the school's enable_finance switch off, every finance route answers 403 and report cards
    are never held for fees."""
    client, ids = env
    s = _seed(ids)
    _setup(client, ids, s)
    h = headers(ids, "admin_a")
    client.put(f"{F}/settings", json={"hold_report_cards_on_arrears": True}, headers=h)
    clock(2026, 10, 20, 9)  # first installment overdue
    url = f"/api/v1/academics/gradebook/report-cards/students/{s['pupils'][0]}"
    assert client.get(url, headers=headers(ids, "parent")).status_code == 403

    gen, db = _db()
    row = db.query(TenantSettings).filter(TenantSettings.tenant_id == ids["tenant_a"]).one()
    row.settings = {**row.settings, "features": {"enable_finance": False}}
    next(gen, None)

    for path, who in (("/accounts", "admin_a"), ("/payments", "cashier"), ("/expenses", "admin_a"),
                      (f"/family/accounts/{s['pupils'][0]}", "parent")):
        r = client.get(f"{F}{path}", headers=headers(ids, who))
        assert r.status_code == 403 and "turned off" in r.json()["detail"], (path, r.text)
    assert client.get(url, headers=headers(ids, "parent")).status_code == 200
    # the parent portal still lists the children, without fee figures
    kids = client.get(f"{F}/family/students", headers=headers(ids, "parent"))
    assert kids.status_code == 200 and kids.json()[0]["finance_enabled"] is False and kids.json()[0]["balance"] == {}
    # the other school is unaffected
    assert client.get(f"{F}/categories", headers=headers(ids, "admin_b")).status_code == 200


# --- lists and reports ----------------------------------------------------------------------------------

def test_accounts_list_is_paged_filtered_and_sorted(env, clock):
    client, ids = env
    s = _seed(ids)
    _setup(client, ids, s)
    clock(2026, 10, 20, 9)
    _pay(client, ids, s, pupil=0, amount="150")             # paid
    _pay(client, ids, s, pupil=1, amount="100")             # owing, not overdue (75 due by 15 Oct)
    _pay(client, ids, s, pupil=3, amount="5000", currency="LRD")  # Grade 2, LRD, overdue (9,000 due)
    h = headers(ids, "admin_a")
    url = f"{F}/accounts"
    body = client.get(url, params={"page_size": 2}, headers=h).json()
    assert body["total"] == 4 and body["pages"] == 2 and len(body["items"]) == 2
    assert body["counts"] == {"all": 4, "owing": 3, "overdue": 2, "paid": 1}
    assert body["totals"]["owed"] == {"USD": "450.00", "LRD": "18000.00"}  # never added together
    assert body["totals"]["paid"] == {"USD": "250.00", "LRD": "5000.00"}
    item = body["items"][0]
    assert set(item) >= {"student_id", "name", "admission_number", "class_name", "currency", "owed", "paid",
                         "balance", "overdue", "last_payment_at"}

    overdue = client.get(url, params={"status": "overdue"}, headers=h).json()
    assert sorted(i["admission_number"] for i in overdue["items"]) == ["P2", "P3"]
    paid = client.get(url, params={"status": "paid"}, headers=h).json()
    assert [i["admission_number"] for i in paid["items"]] == ["P0"]
    g2 = client.get(url, params={"class_id": s["c2"]}, headers=h).json()
    assert [i["currency"] for i in g2["items"]] == ["LRD"] and g2["items"][0]["balance"] == {"LRD": "13000.00"}
    found = client.get(url, params={"q": "p2"}, headers=h).json()
    assert [i["admission_number"] for i in found["items"]] == ["P2"]
    by_balance = client.get(url, params={"sort": "balance"}, headers=h).json()
    assert by_balance["items"][0]["admission_number"] == "P2"  # USD 150 owing, the most
    by_last = client.get(url, params={"sort": "last_payment"}, headers=h).json()
    assert by_last["items"][-1]["admission_number"] == "P2"  # never paid: last
    assert client.get(url, params={"status": "nope"}, headers=h).status_code == 422
    assert client.get(url, headers=headers(ids, "cashier")).status_code == 200
    assert client.get(url, headers=headers(ids, "admin_b")).status_code == 404  # school B has no school year


def test_collections_report_keeps_currencies_apart(env, clock):
    client, ids = env
    s = _seed(ids)
    _setup(client, ids, s)
    _pay(client, ids, s, pupil=0, amount="40", method="cash")
    _pay(client, ids, s, pupil=1, amount="10.25", method="mobile_money", who="principal")
    _pay(client, ids, s, pupil=3, amount="5000", currency="LRD", method="bank")
    gone = _pay(client, ids, s, pupil=2, amount="7").json()
    client.post(f"{F}/payments/{gone['id']}/void", json={"reason": "x"}, headers=headers(ids, "cashier"))
    clock(2026, 11, 2, 8)
    _pay(client, ids, s, pupil=0, amount="1")

    h = headers(ids, "admin_a")
    rep = client.get(f"{F}/reports/collections", params={"from": "2026-11-01", "to": "2026-11-02"}, headers=h).json()
    assert rep["totals"] == {"USD": "51.25", "LRD": "5000.00"} and rep["count"] == 4
    assert [(d["date"], d["totals"]) for d in rep["by_day"]] == [
        ("2026-11-01", {"USD": "50.25", "LRD": "5000.00"}), ("2026-11-02", {"USD": "1.00"})]
    methods = {m["method"]: m["totals"] for m in rep["by_method"]}
    assert methods == {"bank": {"LRD": "5000.00"}, "cash": {"USD": "41.00"}, "mobile_money": {"USD": "10.25"}}
    receivers = {r["received_by"]: r["totals"] for r in rep["by_receiver"]}
    assert receivers[str(ids["principal"])] == {"USD": "10.25"}
    assert rep["voided"] == {"count": 1, "totals": {"USD": "7.00"}}
    one_day = client.get(f"{F}/reports/collections", params={"from": "2026-11-02", "to": "2026-11-02"}, headers=h).json()
    assert one_day["totals"] == {"USD": "1.00"}

    names = client.get(f"{F}/payments/receivers", headers=h).json()
    assert {n["user_id"] for n in names} == {str(ids["cashier"]), str(ids["principal"])}
    arrears = client.get(f"{F}/reports/arrears", headers=h).json()
    assert [c["class_name"] for c in arrears["classes"]] == ["Grade 1 - A", "Grade 2 - A"]
    assert arrears["classes"][0]["students_overdue"] == 3 and arrears["classes"][1]["overdue"] == {"LRD": "4000.00"}
    assert arrears["totals"]["overdue"] == {"USD": "173.75", "LRD": "4000.00"}
    assert client.get(f"{F}/reports/collections", headers=headers(ids, "student_a")).status_code == 403


def test_parent_links_carry_the_students_school(env):
    client, ids = env
    s = _seed(ids)
    gen, db = _db()
    row = db.execute(parent_student.select().where(parent_student.c.parent_id == ids["parent"])).one()
    assert str(row.student_id) == s["pupils"][0] and row.tenant_id == ids["tenant_a"]
    next(gen, None)

"""Platform billing (docs/remodel/phase7-design.md): prices, usage, term invoices, payments with
receipts, voids, each school's access status and the reminders to its admins.

Rules:
- money is Decimal and leaves the API as strings with two decimals ("120.00"); USD and LRD are
  never added together;
- a calendar month is billable in a semester when it overlaps it and no earlier semester of the
  school already took it; months between semesters (holidays) are free;
- staff: every active account that isn't only a student or a parent; platform accounts never count;
- parents and students: one unit per month they signed in, counted from the previous term;
- issuing locks the school's subscription row and is idempotent per (school, semester): one live
  invoice each (a void one may be issued again);
- invoice and receipt numbers come from platform_counters, locked while numbering;
- status (trial, active, read_only, suspended, dormant) is computed here and stored; the API only
  reads it (services/billing/access.py);
- changes are flushed only: the request (or the daily job, per school) commits.
"""
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, UTC
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status as http
from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from src.core.security.auth import SUPER_ADMIN_ROLE_NAMES
from src.db.models.academics.semester import Semester
from src.db.models.auth.user import User
from src.db.models.auth.user_role import UserRole, user_role_association
from src.db.models.billing import (
    PlatformCounter, PlatformInvoice, PlatformInvoiceLine, PlatformPayment, PlatformPrice, PlatformReminder,
    SchoolSubscription, UserActivityMonth,
)
from src.db.models.billing.platform_billing import PAYMENT_METHODS, SUBSCRIPTION_STATUSES
from src.db.models.tenant.tenant import Tenant
from src.services.finance.fee_service import amount_in_words
from src.services.finance.ledger import CENT, CURRENCIES, ZERO, money, money_map, q


TIMEZONE = ZoneInfo("Africa/Monrovia")  # the platform's day (PRD §9)
DUE_DAYS = 30
READ_ONLY_AFTER = 30  # days overdue
SUSPENDED_AFTER = 60
DUE_SOON_DAYS = 7  # the banner's "due soon"
REMINDERS = (("due", 0), ("due_7", 7), ("due_14", 14))  # (kind, days after the due date)
FAMILY_ROLES = ("student", "parent")
SCHOOL_ADMIN_ROLE = "admin"
RANK = {"trial": 0, "active": 0, "read_only": 1, "suspended": 2}
MAX_PAGE_SIZE = 100


def _now() -> datetime:
    """Current time (UTC). Tests replace it to fix "today"."""
    return datetime.now(UTC)


def today() -> date:
    return _now().astimezone(TIMEZONE).date()


def _404(what: str):
    return HTTPException(status_code=http.HTTP_404_NOT_FOUND, detail=f"{what} not found")


def _422(detail: Any):
    return HTTPException(status_code=http.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


def _409(detail: Any):
    return HTTPException(status_code=http.HTTP_409_CONFLICT, detail=detail)


def _uuid(value) -> Optional[UUID]:
    if value is None or isinstance(value, UUID):
        return value
    return UUID(str(value))


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)  # SQLite returns naive UTC


def _name(user) -> Optional[str]:
    if user is None:
        return None
    return f"{user.first_name or ''} {user.last_name or ''}".strip() or getattr(user, "username", None)


def _day(d: date) -> str:
    return f"{d.day} {d.strftime('%b %Y')}"


def parse_amount(value, field: str, *, allow_zero: bool = True) -> Decimal:
    """A money input: at most 2 decimals, not negative (or positive when allow_zero is False)."""
    try:
        d = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise _422(f"{field} is not an amount")
    if not d.is_finite() or d != d.quantize(CENT):
        raise _422(f"{field} can have at most 2 decimals")
    if d < 0 or (not allow_zero and d == 0):
        raise _422(f"{field} must be {'0 or more' if allow_zero else 'more than 0'}")
    if d >= Decimal("10000000000"):
        raise _422(f"{field} is too large")
    return q(d)


def amount_text(amounts: Dict[str, Decimal]) -> str:
    """ "USD 120.00 (or LRD 21,600.00)": either currency pays an invoice not yet paid in one."""
    parts = [f"{c} {q(amounts[c]):,.2f}" for c in CURRENCIES if amounts.get(c)]
    return parts[0] + (f" (or {parts[1]})" if len(parts) > 1 else "") if parts else "nothing"


# --- months -----------------------------------------------------------------------------------------

def months_between(start: date, end: date) -> List[date]:
    """First days of the calendar months from start's to end's, inclusive."""
    out, m = [], start.replace(day=1)
    while m <= end:
        out.append(m)
        m = (m.replace(day=28) + timedelta(days=4)).replace(day=1)
    return out


def billable_months(semester, semesters: Sequence) -> List[date]:
    """The months the semester is billed for: those it overlaps, less any an earlier semester of the
    school overlaps too (a month shared by two terms is billed once)."""
    key = (semester.start_date, str(semester.id))
    taken = {m for s in semesters if (s.start_date, str(s.id)) < key for m in months_between(s.start_date, s.end_date)}
    return [m for m in months_between(semester.start_date, semester.end_date) if m not in taken]


# --- invoice arithmetic (no database) ---------------------------------------------------------------

@dataclass
class Usage:
    staff: int
    months: List[date]
    family_months: int
    previous_semester: Optional[Any] = None


def term_lines(price: PlatformPrice, usage: Usage, first_term_free: bool, term_name: str = "the term") -> List[Dict]:
    """An invoice's lines: staff for the term, the previous term's family months, a top-up to the term
    minimum, and (a school's first term) a line taking the whole amount off."""
    lines = []

    def add(kind, description, quantity, unit_usd, unit_lrd, amount_usd=None, amount_lrd=None):
        lines.append({"kind": kind, "description": description[:255], "quantity": quantity,
                      "unit_usd": q(unit_usd), "unit_lrd": q(unit_lrd),
                      "amount_usd": q(amount_usd if amount_usd is not None else unit_usd * quantity),
                      "amount_lrd": q(amount_lrd if amount_lrd is not None else unit_lrd * quantity)})

    n = len(usage.months)
    if usage.staff and n:
        add("staff", f"Staff accounts: {usage.staff} × {n} month{'s' if n != 1 else ''} of {term_name}",
            usage.staff * n, price.staff_per_month_usd, price.staff_per_month_lrd)
    if usage.family_months:
        prev = getattr(usage.previous_semester, "name", None) or "the previous term"
        add("family", f"Parent and student sign-ins: {usage.family_months} user-months in {prev}",
            usage.family_months, price.family_per_month_usd, price.family_per_month_lrd)
    usd = sum((l["amount_usd"] for l in lines), ZERO)
    lrd = sum((l["amount_lrd"] for l in lines), ZERO)
    top_usd = max(ZERO, q(price.term_minimum_usd) - usd)
    top_lrd = max(ZERO, q(price.term_minimum_lrd) - lrd)
    if top_usd or top_lrd:
        add("minimum", "Top-up to the term minimum", 1, top_usd, top_lrd)
        usd, lrd = usd + top_usd, lrd + top_lrd
    if first_term_free:
        add("first_term_free", "First term free", 1, -usd, -lrd)
    return lines


def invoice_totals(lines: Iterable) -> Dict[str, Decimal]:
    out = {c: ZERO for c in CURRENCIES}
    for l in lines:
        out["USD"] += q(l.amount_usd if hasattr(l, "amount_usd") else l["amount_usd"])
        out["LRD"] += q(l.amount_lrd if hasattr(l, "amount_lrd") else l["amount_lrd"])
    return {c: q(v) for c, v in out.items()}


def target_status(current: str, oldest_due: Optional[date], charged: bool, grace_until: Optional[date],
                  on: date) -> Tuple[str, str]:
    """The status a school should have on a day, with the reason. Dormant stays until the operator
    lifts it; within a grace period the status doesn't get worse."""
    if current == "dormant":
        return current, ""
    if oldest_due is None:
        target, reason = ("trial", "No charge yet") if current == "trial" and not charged else ("active", "Nothing overdue")
    else:
        overdue = (on - oldest_due).days
        if overdue >= SUSPENDED_AFTER:
            target, reason = "suspended", f"{overdue} days overdue (since {_day(oldest_due)})"
        elif overdue >= READ_ONLY_AFTER:
            target, reason = "read_only", f"{overdue} days overdue (since {_day(oldest_due)})"
        else:
            target = "trial" if current == "trial" and not charged else "active"
            reason = "Invoice not yet overdue" if overdue <= 0 else f"{overdue} days overdue (since {_day(oldest_due)})"
    if grace_until and on <= grace_until and RANK.get(target, 0) > RANK.get(current, 0):
        return current, f"Grace until {_day(grace_until)}"
    return target, reason


# --- helpers shared with access.py ------------------------------------------------------------------

def is_school_admin(user) -> bool:
    return any(r.name == SCHOOL_ADMIN_ROLE and getattr(r, "tenant_id", None) is None for r in getattr(user, "roles", []))


def school_admin_ids(db: Session, tenant_id) -> List[UUID]:
    return [r[0] for r in db.query(User.id)
            .join(user_role_association, user_role_association.c.user_id == User.id)
            .join(UserRole, UserRole.id == user_role_association.c.role_id)
            .filter(User.tenant_id == _uuid(tenant_id), User.is_active == True,  # noqa: E712
                    UserRole.name == SCHOOL_ADMIN_ROLE, UserRole.tenant_id.is_(None)).distinct()]


def stored_status(db: Session, tenant_id) -> str:
    """The school's stored status: one primary-key lookup. A school without a row is on trial."""
    value = db.query(SchoolSubscription.status).filter(SchoolSubscription.tenant_id == _uuid(tenant_id)).scalar()
    return value or "trial"


class BillingService:
    def __init__(self, db: Session, user: Any = None):
        self.db = db
        self.user = user

    @property
    def user_id(self) -> Optional[UUID]:
        return getattr(self.user, "id", None)

    # --- lookups -------------------------------------------------------------------------------

    def school(self, tenant_id) -> Tenant:
        tenant = self.db.query(Tenant).filter(Tenant.id == _uuid(tenant_id)).first()
        if tenant is None:
            raise _404("School")
        return tenant

    def subscription(self, tenant_id, *, lock: bool = False) -> SchoolSubscription:
        """The school's subscription row, created (on trial) when missing."""
        tenant_id = _uuid(tenant_id)
        query = self.db.query(SchoolSubscription).filter(SchoolSubscription.tenant_id == tenant_id)
        sub = (query.with_for_update() if lock else query).first()
        if sub is None:
            self.school(tenant_id)
            values = {"tenant_id": tenant_id, "status": "trial", "status_since": _now(), "status_reason": "New school",
                      "first_term_free_used": False, "created_at": _now(), "updated_at": _now()}
            dialect = self.db.get_bind().dialect.name
            if dialect in ("postgresql", "sqlite"):
                insert = pg_insert if dialect == "postgresql" else sqlite_insert
                self.db.execute(insert(SchoolSubscription).values(**values).on_conflict_do_nothing(
                    index_elements=["tenant_id"]))
            else:
                self.db.add(SchoolSubscription(**values))
                self.db.flush()
            sub = (query.with_for_update() if lock else query).one()
        return sub

    def _users(self, ids: Iterable) -> Dict[UUID, User]:
        ids = {i for i in ids if i is not None}
        if not ids:
            return {}
        return {u.id: u for u in self.db.query(User).filter(User.id.in_(ids))}

    def _semesters(self, tenant_id) -> List[Semester]:
        return (self.db.query(Semester).filter(Semester.tenant_id == _uuid(tenant_id))
                .order_by(Semester.start_date, Semester.id).all())

    def _invoice(self, invoice_id, tenant_id=None, *, lock: bool = False) -> PlatformInvoice:
        query = self.db.query(PlatformInvoice).filter(PlatformInvoice.id == _uuid(invoice_id))
        if tenant_id is not None:
            query = query.filter(PlatformInvoice.tenant_id == _uuid(tenant_id))
        invoice = (query.with_for_update() if lock else query).first()
        if invoice is None:
            raise _404("Invoice")
        return invoice

    def _payment(self, payment_id, tenant_id=None) -> PlatformPayment:
        query = self.db.query(PlatformPayment).filter(PlatformPayment.id == _uuid(payment_id))
        if tenant_id is not None:
            query = query.filter(PlatformPayment.tenant_id == _uuid(tenant_id))
        payment = query.first()
        if payment is None:
            raise _404("Payment")
        return payment

    # --- prices --------------------------------------------------------------------------------

    def price_in_force(self, on: date) -> Optional[PlatformPrice]:
        return (self.db.query(PlatformPrice).filter(PlatformPrice.effective_from <= on)
                .order_by(PlatformPrice.effective_from.desc()).first())

    def _price_out(self, p: PlatformPrice, people=None, current_id=None) -> Dict[str, Any]:
        people = people if people is not None else self._users([p.created_by])
        return {"id": p.id, "effective_from": p.effective_from,
                "staff_per_month_usd": money(p.staff_per_month_usd), "staff_per_month_lrd": money(p.staff_per_month_lrd),
                "family_per_month_usd": money(p.family_per_month_usd),
                "family_per_month_lrd": money(p.family_per_month_lrd),
                "term_minimum_usd": money(p.term_minimum_usd), "term_minimum_lrd": money(p.term_minimum_lrd),
                "created_by": p.created_by, "created_by_name": _name(people.get(p.created_by)),
                "created_at": _aware(p.created_at), "in_force": p.id == current_id}

    def list_prices(self) -> List[Dict[str, Any]]:
        prices = self.db.query(PlatformPrice).order_by(PlatformPrice.effective_from.desc()).all()
        people = self._users(p.created_by for p in prices)
        current = self.price_in_force(today())
        return [self._price_out(p, people, current.id if current else None) for p in prices]

    def add_price(self, data: Dict[str, Any]) -> Dict[str, Any]:
        effective = data.get("effective_from")
        if not isinstance(effective, date):
            raise _422("effective_from is required")
        if self.db.query(PlatformPrice.id).filter(PlatformPrice.effective_from == effective).first():
            raise _409(f"A price list already starts on {_day(effective)}")
        fields = ("staff_per_month_usd", "staff_per_month_lrd", "family_per_month_usd", "family_per_month_lrd",
                  "term_minimum_usd", "term_minimum_lrd")
        values = {}
        for f in fields:
            if data.get(f) is None:
                raise _422(f"{f} is required")
            values[f] = parse_amount(data[f], f)
        price = PlatformPrice(effective_from=effective, created_by=self.user_id, created_at=_now(), **values)
        self.db.add(price)
        self.db.flush()
        current = self.price_in_force(today())
        return self._price_out(price, current_id=current.id if current else None)

    # --- usage ---------------------------------------------------------------------------------

    def _classify(self, tenant_id, *, active_only: bool) -> Dict[UUID, str]:
        """Each account of the school: "staff" or "family" (only student and/or parent built-in roles;
        an account with no role counts by its type). Platform accounts are left out."""
        query = self.db.query(User.id, User.type).filter(User.tenant_id == _uuid(tenant_id))
        if active_only:
            query = query.filter(User.is_active == True)  # noqa: E712
        users = {uid: utype for uid, utype in query.all()}
        roles = defaultdict(list)
        if users:
            for uid, name, role_tenant in (self.db.query(user_role_association.c.user_id, UserRole.name, UserRole.tenant_id)
                                           .join(UserRole, UserRole.id == user_role_association.c.role_id)
                                           .filter(user_role_association.c.user_id.in_(list(users)))):
                roles[uid].append((name, role_tenant))
        out = {}
        for uid, utype in users.items():
            held = roles.get(uid, [])
            if any(name in SUPER_ADMIN_ROLE_NAMES and rt is None for name, rt in held):
                continue
            if held:
                family = all(rt is None and name in FAMILY_ROLES for name, rt in held)
            else:
                family = utype in FAMILY_ROLES
            out[uid] = "family" if family else "staff"
        return out

    def staff_count(self, tenant_id) -> int:
        return sum(1 for kind in self._classify(tenant_id, active_only=True).values() if kind == "staff")

    def family_months(self, tenant_id, months: Sequence[date]) -> int:
        """Parent and student user-months signed in during the given months."""
        if not months:
            return 0
        kinds = self._classify(tenant_id, active_only=False)
        rows = self.db.query(UserActivityMonth.user_id).filter(
            UserActivityMonth.tenant_id == _uuid(tenant_id), UserActivityMonth.month.in_(list(months))).all()
        return sum(1 for (uid,) in rows if kinds.get(uid) == "family")

    def usage_for(self, tenant_id, semester: Semester, semesters: Optional[Sequence] = None) -> Usage:
        semesters = semesters if semesters is not None else self._semesters(tenant_id)
        earlier = [s for s in semesters if (s.start_date, str(s.id)) < (semester.start_date, str(semester.id))]
        previous = earlier[-1] if earlier else None
        family = self.family_months(tenant_id, billable_months(previous, semesters)) if previous else 0
        return Usage(staff=self.staff_count(tenant_id), months=billable_months(semester, semesters),
                     family_months=family, previous_semester=previous)

    def usage_by_month(self, tenant_id, months: int = 12) -> List[Dict[str, Any]]:
        start = today().replace(day=1)
        for _ in range(months - 1):
            start = (start - timedelta(days=1)).replace(day=1)
        kinds = self._classify(tenant_id, active_only=False)
        counts = defaultdict(lambda: {"staff": 0, "family": 0})
        for uid, month in self.db.query(UserActivityMonth.user_id, UserActivityMonth.month).filter(
                UserActivityMonth.tenant_id == _uuid(tenant_id), UserActivityMonth.month >= start):
            kind = kinds.get(uid)
            if kind:
                counts[month][kind] += 1
        return [{"month": m, "staff_signed_in": counts[m]["staff"], "family_signed_in": counts[m]["family"]}
                for m in months_between(start, today())]

    # --- numbering -----------------------------------------------------------------------------

    def next_number(self, name: str, year: int) -> int:
        """The next number of a series for a year; the counter row stays locked until commit."""
        dialect = self.db.get_bind().dialect.name
        if dialect in ("postgresql", "sqlite"):
            insert = pg_insert if dialect == "postgresql" else sqlite_insert
            self.db.execute(insert(PlatformCounter).values(name=name, year=year, last_number=0)
                            .on_conflict_do_nothing(index_elements=["name", "year"]))
        counter = self.db.execute(select(PlatformCounter).where(PlatformCounter.name == name, PlatformCounter.year == year)
                                  .with_for_update()).scalar_one_or_none()
        if counter is None:  # other databases
            counter = PlatformCounter(name=name, year=year, last_number=0)
            self.db.add(counter)
        counter.last_number = (counter.last_number or 0) + 1
        self.db.flush()
        return counter.last_number

    # --- invoices ------------------------------------------------------------------------------

    def issue(self, tenant_id, semester_id) -> Tuple[PlatformInvoice, bool]:
        """The school's invoice for the semester: the live one if it exists, else a new one."""
        tenant_id = _uuid(tenant_id)
        sub = self.subscription(tenant_id, lock=True)  # one issue per school at a time
        semesters = self._semesters(tenant_id)
        semester = next((s for s in semesters if s.id == _uuid(semester_id)), None)
        if semester is None:
            raise _404("Semester")
        existing = self.db.query(PlatformInvoice).filter(
            PlatformInvoice.tenant_id == tenant_id, PlatformInvoice.semester_id == semester.id,
            PlatformInvoice.status == "issued").first()
        if existing is not None:
            return existing, False
        on = today()
        price = self.price_in_force(on)
        if price is None:
            raise _409("Set the platform price list first")
        usage = self.usage_for(tenant_id, semester, semesters)
        free = not sub.first_term_free_used
        lines = term_lines(price, usage, free, semester.name)
        number = f"PINV-{on.year}-{self.next_number('PINV', on.year):05d}"
        now = _now()
        invoice = PlatformInvoice(tenant_id=tenant_id, number=number, semester_id=semester.id, price_id=price.id,
                                  period_start=semester.start_date, period_end=semester.end_date, issued_at=now,
                                  issued_by=self.user_id, due_date=on + timedelta(days=DUE_DAYS), status="issued",
                                  created_at=now, updated_at=now)
        self.db.add(invoice)
        self.db.flush()
        for line in lines:
            self.db.add(PlatformInvoiceLine(invoice_id=invoice.id, created_at=now, **line))
        if free:
            sub.first_term_free_used = True
        self.db.flush()
        self.refresh_status(tenant_id)
        return invoice, True

    def issue_out(self, tenant_id, semester_id) -> Dict[str, Any]:
        invoice, created = self.issue(tenant_id, semester_id)
        out = self.invoice_detail(invoice.id)
        out["created"] = created
        return out

    def void_invoice(self, invoice_id, reason: str) -> Dict[str, Any]:
        invoice = self._invoice(invoice_id, lock=True)
        if invoice.status == "void":
            raise _409("This invoice is already void")
        if not (reason or "").strip():
            raise _422("Give a reason")
        if self.db.query(PlatformPayment.id).filter(PlatformPayment.invoice_id == invoice.id,
                                                    PlatformPayment.voided_at.is_(None)).first():
            raise _409("Payments are recorded against this invoice. Void those payments first.")
        invoice.status = "void"
        invoice.voided_at = _now()
        invoice.voided_by = self.user_id
        invoice.void_reason = reason.strip()
        if any(l.kind == "first_term_free" for l in invoice.lines):
            # The free term wasn't used after all: the reissued invoice gets it again
            self.subscription(invoice.tenant_id).first_term_free_used = False
        self.db.flush()
        self.refresh_status(invoice.tenant_id)
        return self.invoice_detail(invoice.id)

    def _paid(self, invoice_ids: Sequence) -> Dict[UUID, Dict[str, Decimal]]:
        out = defaultdict(dict)
        if not invoice_ids:
            return out
        for inv_id, currency, total in (self.db.query(PlatformPayment.invoice_id, PlatformPayment.currency,
                                                      func.sum(PlatformPayment.amount))
                                        .filter(PlatformPayment.invoice_id.in_(list(invoice_ids)),
                                                PlatformPayment.voided_at.is_(None))
                                        .group_by(PlatformPayment.invoice_id, PlatformPayment.currency)):
            out[inv_id][currency] = q(total)
        return out

    def _lines(self, invoice_ids: Sequence) -> Dict[UUID, List[PlatformInvoiceLine]]:
        out = defaultdict(list)
        if invoice_ids:
            for l in (self.db.query(PlatformInvoiceLine).filter(PlatformInvoiceLine.invoice_id.in_(list(invoice_ids)))
                      .order_by(PlatformInvoiceLine.created_at)):
                out[l.invoice_id].append(l)
        return out

    def amounts(self, invoices: Sequence[PlatformInvoice]) -> Dict[UUID, Dict[str, Any]]:
        """Per invoice: total and balance per currency (both before the currency is fixed), what was
        paid, and whether anything is still owed."""
        ids = [i.id for i in invoices]
        lines, paid = self._lines(ids), self._paid(ids)
        out = {}
        for inv in invoices:
            total = invoice_totals(lines[inv.id])
            if inv.status == "void":
                balance = {}
            elif inv.currency:
                balance = {inv.currency: q(total[inv.currency] - paid[inv.id].get(inv.currency, ZERO))}
            else:
                balance = dict(total)
            out[inv.id] = {"total": total, "paid": dict(paid[inv.id]), "balance": balance,
                           "owing": any(v > 0 for v in balance.values()), "charged": any(v > 0 for v in total.values())}
        return out

    def _invoices(self, tenant_id, *, live_only: bool = False) -> List[PlatformInvoice]:
        query = self.db.query(PlatformInvoice).filter(PlatformInvoice.tenant_id == _uuid(tenant_id))
        if live_only:
            query = query.filter(PlatformInvoice.status == "issued")
        return query.order_by(PlatformInvoice.issued_at.desc()).all()

    def account(self, tenant_id) -> Dict[str, Any]:
        """What the school owes: amount due per currency, the oldest unpaid due date and whether any
        invoice has charged it anything."""
        invoices = self._invoices(tenant_id, live_only=True)
        amounts = self.amounts(invoices)
        due: Dict[str, Decimal] = {}
        oldest = None
        oldest_invoice = None
        for inv in invoices:
            a = amounts[inv.id]
            if not a["owing"]:
                continue
            for c, v in a["balance"].items():
                if v > 0:
                    due[c] = q(due.get(c, ZERO) + v)
            if oldest is None or inv.due_date < oldest:
                oldest, oldest_invoice = inv.due_date, inv
        return {"amount_due": due, "oldest_due_date": oldest, "oldest_invoice": oldest_invoice,
                "charged": any(a["charged"] for a in amounts.values()), "invoices": invoices, "amounts": amounts}

    def _semester_names(self, ids: Iterable) -> Dict[UUID, str]:
        ids = list({i for i in ids if i})
        if not ids:
            return {}
        return {s.id: s.name for s in self.db.query(Semester.id, Semester.name).filter(Semester.id.in_(ids))}

    def _invoice_row(self, inv: PlatformInvoice, a: Dict[str, Any], sems: Dict[UUID, str]) -> Dict[str, Any]:
        return {"id": inv.id, "tenant_id": inv.tenant_id, "number": inv.number, "semester_id": inv.semester_id,
                "semester_name": sems.get(inv.semester_id), "period_start": inv.period_start,
                "period_end": inv.period_end, "issued_at": _aware(inv.issued_at), "due_date": inv.due_date,
                "currency": inv.currency, "status": inv.status,
                "total": money_map(a["total"]), "paid": money_map(a["paid"]), "balance": money_map(a["balance"]),
                "owing": a["owing"], "void_reason": inv.void_reason, "voided_at": _aware(inv.voided_at)}

    def _payment_row(self, p: PlatformPayment, people: Dict[UUID, User]) -> Dict[str, Any]:
        return {"id": p.id, "invoice_id": p.invoice_id, "receipt_number": p.receipt_number, "amount": money(p.amount),
                "currency": p.currency, "method": p.method, "reference": p.reference, "provider": p.provider,
                "provider_ref": p.provider_ref, "received_at": _aware(p.received_at), "recorded_by": p.recorded_by,
                "recorded_by_name": _name(people.get(p.recorded_by)), "voided": p.voided_at is not None,
                "voided_at": _aware(p.voided_at), "voided_by_name": _name(people.get(p.voided_by)),
                "void_reason": p.void_reason}

    def invoice_list(self, tenant_id) -> List[Dict[str, Any]]:
        invoices = self._invoices(tenant_id)
        amounts = self.amounts(invoices)
        sems = self._semester_names(i.semester_id for i in invoices)
        return [self._invoice_row(i, amounts[i.id], sems) for i in invoices]

    def invoice_detail(self, invoice_id, tenant_id=None) -> Dict[str, Any]:
        inv = self._invoice(invoice_id, tenant_id)
        a = self.amounts([inv])[inv.id]
        row = self._invoice_row(inv, a, self._semester_names([inv.semester_id]))
        payments = (self.db.query(PlatformPayment).filter(PlatformPayment.invoice_id == inv.id)
                    .order_by(PlatformPayment.received_at).all())
        people = self._users([p.recorded_by for p in payments] + [p.voided_by for p in payments])
        row["lines"] = [{"id": l.id, "kind": l.kind, "description": l.description, "quantity": l.quantity,
                         "unit_usd": money(l.unit_usd), "unit_lrd": money(l.unit_lrd),
                         "amount_usd": money(l.amount_usd), "amount_lrd": money(l.amount_lrd)}
                        for l in self._lines([inv.id])[inv.id]]
        row["payments"] = [self._payment_row(p, people) for p in payments]
        return row

    # --- payments ------------------------------------------------------------------------------

    def record_payment(self, invoice_id, data: Dict[str, Any], *, provider: Optional[str] = None,
                       provider_ref: Optional[str] = None) -> Dict[str, Any]:
        invoice = self._invoice(invoice_id, lock=True)  # SELECT ... FOR UPDATE: one payment at a time
        if invoice.status == "void":
            raise _409("This invoice is void")
        if data.get("amount") is None:
            raise _422("amount is required")
        amount = parse_amount(data.get("amount"), "amount", allow_zero=False)
        currency = (data.get("currency") or "").upper()
        if currency not in CURRENCIES:
            raise _422("currency must be USD or LRD")
        method = data.get("method")
        if method not in PAYMENT_METHODS:
            raise _422("method must be bank, mobile_money, cash or online")
        if (method == "online") != (provider is not None):
            raise _422("Online payments are recorded by their provider")
        received_at = _aware(data.get("received_at")) or _now()
        if received_at > _now() + timedelta(minutes=5):
            raise _422("received_at can't be in the future")
        if invoice.currency and currency != invoice.currency:
            raise _409(f"This invoice is being paid in {invoice.currency}")
        a = self.amounts([invoice])[invoice.id]
        balance = q(a["total"][currency] - a["paid"].get(currency, ZERO))
        if amount > balance:
            raise _409(f"Balance is {currency} {money(balance)}")

        year = today().year
        number = f"PRCPT-{year}-{self.next_number('PRCPT', year):05d}"
        payment = PlatformPayment(invoice_id=invoice.id, tenant_id=invoice.tenant_id, receipt_number=number,
                                  amount=amount, currency=currency, method=method,
                                  reference=(data.get("reference") or None), provider=provider,
                                  provider_ref=provider_ref, received_at=received_at, recorded_by=self.user_id,
                                  created_at=_now())
        self.db.add(payment)
        if not invoice.currency:
            invoice.currency = currency
        self.db.flush()
        self.refresh_status(invoice.tenant_id)  # paying restores access at once
        return self.receipt(payment.id)

    def void_payment(self, payment_id, reason: str) -> Dict[str, Any]:
        p = self._payment(payment_id)
        invoice = self._invoice(p.invoice_id, lock=True)
        if p.voided_at is not None:
            raise _409("This payment is already void")
        if not (reason or "").strip():
            raise _422("Give a reason")
        p.voided_at = _now()
        p.voided_by = self.user_id
        p.void_reason = reason.strip()
        self.db.flush()
        if not self.db.query(PlatformPayment.id).filter(PlatformPayment.invoice_id == invoice.id,
                                                        PlatformPayment.voided_at.is_(None)).first():
            invoice.currency = None  # nothing paid any more: either currency can pay again
        self.db.flush()
        self.refresh_status(invoice.tenant_id)
        return self.receipt(p.id)

    def receipt(self, payment_id, tenant_id=None) -> Dict[str, Any]:
        p = self._payment(payment_id, tenant_id)
        invoice = self._invoice(p.invoice_id)
        school = self.school(p.tenant_id)
        a = self.amounts([invoice])[invoice.id]
        row = self._payment_row(p, self._users([p.recorded_by, p.voided_by]))
        row.update({"amount_in_words": amount_in_words(p.amount, p.currency),
                    "invoice_number": invoice.number, "invoice_total": money(a["total"][p.currency]),
                    "balance_now": money_map(a["balance"]),
                    "school": {"id": school.id, "name": school.name, "code": school.code}})
        return row

    # --- status --------------------------------------------------------------------------------

    def refresh_status(self, tenant_id, on: Optional[date] = None) -> Tuple[str, str]:
        """Recompute and store the school's status. Returns (old, new)."""
        on = on or today()
        sub = self.subscription(tenant_id)
        acct = self.account(tenant_id)
        target, reason = target_status(sub.status, acct["oldest_due_date"], acct["charged"], sub.grace_until, on)
        old = sub.status
        if target != old:
            sub.status = target
            sub.status_since = _now()
            sub.status_reason = reason
            sub.updated_at = _now()
            self.db.flush()
        return old, target

    def update_subscription(self, tenant_id, data: Dict[str, Any]) -> Dict[str, Any]:
        sub = self.subscription(tenant_id, lock=True)
        if "grace_until" in data:
            sub.grace_until = data["grace_until"]
        dormant = data.get("dormant")
        if dormant is True and sub.status != "dormant":
            sub.status, sub.status_since, sub.status_reason = "dormant", _now(), "Marked dormant by the platform"
        elif dormant is False and sub.status == "dormant":
            sub.status, sub.status_since, sub.status_reason = "active", _now(), "Dormancy lifted by the platform"
        sub.updated_at = _now()
        self.db.flush()
        self.refresh_status(tenant_id)
        return self.subscription_out(tenant_id)

    def subscription_out(self, tenant_id) -> Dict[str, Any]:
        sub = self.subscription(tenant_id)
        return {"tenant_id": sub.tenant_id, "status": sub.status, "status_since": _aware(sub.status_since),
                "status_reason": sub.status_reason, "grace_until": sub.grace_until,
                "first_term_free_used": sub.first_term_free_used}

    def school_status(self, tenant_id, user) -> Dict[str, Any]:
        """The app shell's banner (GET /billing/status): admins see the amount; others a plain line."""
        sub = self.db.query(SchoolSubscription).filter(SchoolSubscription.tenant_id == _uuid(tenant_id)).first()
        current = sub.status if sub else "trial"
        acct = self.account(tenant_id)
        oldest = acct["oldest_due_date"]
        admin = is_school_admin(user) or _is_platform(user)
        read_only_on = suspended_on = None
        if oldest is not None:
            read_only_on = oldest + timedelta(days=READ_ONLY_AFTER)
            suspended_on = oldest + timedelta(days=SUSPENDED_AFTER)
            if sub and sub.grace_until:
                read_only_on = max(read_only_on, sub.grace_until + timedelta(days=1))
                suspended_on = max(suspended_on, sub.grace_until + timedelta(days=1))
        banner = banner_for(current, oldest, today())
        return {"status": current, "status_since": _aware(sub.status_since) if sub else None,
                "grace_until": sub.grace_until if sub else None,
                "amount_due": money_map(acct["amount_due"]) if admin else None,
                "oldest_due_date": oldest, "read_only_on": read_only_on, "suspended_on": suspended_on,
                "banner": banner, "is_admin": admin,
                "message": status_message(banner, acct["amount_due"], oldest, read_only_on, admin)}

    # --- reminders -----------------------------------------------------------------------------

    def _reminded(self, invoice_id) -> set:
        return {r[0] for r in self.db.query(PlatformReminder.kind).filter(PlatformReminder.invoice_id == invoice_id)}

    def _remind(self, tenant_id, invoice: PlatformInvoice, kinds: List[str], balance: Dict[str, Decimal]) -> int:
        """Record the reminders (each kind once per invoice) and alert the admins about the latest."""
        from src.services.notification.alerts import school_prefix
        from src.services.notification.notify import notify
        for kind in kinds:
            self.db.add(PlatformReminder(invoice_id=invoice.id, kind=kind, sent_at=_now()))
        self.db.flush()
        kind = kinds[-1]
        amount = amount_text(balance)
        ro_on = invoice.due_date + timedelta(days=READ_ONLY_AFTER)
        title, body = {
            "due": ("Platform invoice due today",
                    f"Invoice {invoice.number} is due today: {amount}. If it isn't paid, the school's account "
                    f"becomes read-only on {_day(ro_on)}."),
            "due_7": ("Platform invoice overdue",
                      f"Invoice {invoice.number} ({amount}) was due on {_day(invoice.due_date)}. The school's "
                      f"account becomes read-only on {_day(ro_on)}."),
            "due_14": ("Platform invoice overdue",
                       f"Invoice {invoice.number} ({amount}) was due on {_day(invoice.due_date)}. The school's "
                       f"account becomes read-only on {_day(ro_on)}."),
            "read_only": ("School account is read-only",
                          f"Invoice {invoice.number} is {READ_ONLY_AFTER} days overdue, so the school's account is "
                          f"read-only. Pay {amount} to restore access."),
            "suspended": ("School account is suspended",
                          f"Invoice {invoice.number} is {SUSPENDED_AFTER} days overdue, so only administrators can "
                          f"sign in. Pay {amount} to restore access; you can still export the school's data."),
        }[kind]
        return notify(self.db, tenant_id, event="billing_reminder", recipients=school_admin_ids(self.db, tenant_id),
                      title=title, body=body, link=f"{school_prefix(self.db, tenant_id)}/settings/billing",
                      data={"invoice_id": str(invoice.id), "kind": kind},
                      source_key=f"platform_invoice:{invoice.id}:{kind}")

    def send_reminders(self, tenant_id, on: Optional[date] = None, status_change: Optional[str] = None) -> int:
        """Due-date reminders for every unpaid invoice, and the read-only / suspended notice when the
        status just moved there. A missed day sends one alert, not a backlog."""
        on = on or today()
        acct = self.account(tenant_id)
        sent = 0
        for inv in acct["invoices"]:
            a = acct["amounts"][inv.id]
            if not a["owing"] or inv.due_date > on:
                continue
            done = self._reminded(inv.id)
            new = [k for k, days in REMINDERS if on >= inv.due_date + timedelta(days=days) and k not in done]
            if new:
                self._remind(tenant_id, inv, new, a["balance"])
                sent += 1
        inv = acct["oldest_invoice"]
        if status_change in ("read_only", "suspended") and inv is not None and status_change not in self._reminded(inv.id):
            self._remind(tenant_id, inv, [status_change], acct["amounts"][inv.id]["balance"])
            sent += 1
        return sent

    # --- the daily job -------------------------------------------------------------------------

    def current_semester(self, tenant_id, on: date) -> Optional[Semester]:
        """The semester in progress (the latest one started that hasn't ended)."""
        running = [s for s in self._semesters(tenant_id) if s.start_date <= on <= s.end_date]
        return running[-1] if running else None

    def run_for_school(self, tenant_id, on: Optional[date] = None) -> Dict[str, Any]:
        """Issue the term invoice (once), move the status and send reminders, for one school."""
        on = on or today()
        tenant = self.school(tenant_id)
        sub = self.subscription(tenant_id)
        result = {"tenant_id": tenant.id, "issued": None, "status": sub.status, "reminders": 0}
        if sub.status == "dormant" or not tenant.is_active:
            return result
        semester = self.current_semester(tenant_id, on)
        if semester is not None and not self.db.query(PlatformInvoice.id).filter(
                PlatformInvoice.tenant_id == tenant.id, PlatformInvoice.semester_id == semester.id).first():
            # A voided invoice is not issued again automatically: the operator reissues it
            if self.price_in_force(on) is None:
                result["skipped"] = "no price list"
            else:
                invoice, created = self.issue(tenant.id, semester.id)
                result["issued"] = invoice.number if created else None
        old, new = self.refresh_status(tenant.id, on)
        result["status"] = new
        result["reminders"] = self.send_reminders(tenant.id, on, status_change=new if new != old else None)
        return result

    # --- platform views ------------------------------------------------------------------------

    def _school_row(self, tenant: Tenant, sub: Optional[SchoolSubscription]) -> Dict[str, Any]:
        acct = self.account(tenant.id)
        semesters = self._semesters(tenant.id)
        on = today()
        started = [s for s in semesters if s.start_date <= on]
        last_term = None
        if started:
            current = started[-1]
            earlier = [s for s in semesters if (s.start_date, str(s.id)) < (current.start_date, str(current.id))]
            # "Last term": the latest one that has ended
            last_term = current if current.end_date < on else (earlier[-1] if earlier else None)
        family = self.family_months(tenant.id, billable_months(last_term, semesters)) if last_term else 0
        return {"tenant_id": tenant.id, "name": tenant.name, "code": tenant.code, "domain": tenant.domain,
                "is_active": tenant.is_active, "status": sub.status if sub else "trial",
                "status_since": _aware(sub.status_since) if sub else None,
                "grace_until": sub.grace_until if sub else None,
                "amount_due": money_map(acct["amount_due"]), "oldest_due_date": acct["oldest_due_date"],
                "staff_count": self.staff_count(tenant.id),
                "last_term_name": last_term.name if last_term else None, "last_term_family_months": family}

    def list_schools(self, *, status_filter: Optional[str] = None, q_text: Optional[str] = None, page: int = 1,
                     page_size: int = 25) -> Dict[str, Any]:
        if status_filter and status_filter not in SUBSCRIPTION_STATUSES:
            raise _422(f"status must be one of {', '.join(SUBSCRIPTION_STATUSES)}")
        query = (self.db.query(Tenant, SchoolSubscription)
                 .outerjoin(SchoolSubscription, SchoolSubscription.tenant_id == Tenant.id))
        if status_filter == "trial":
            query = query.filter(or_(SchoolSubscription.status == "trial", SchoolSubscription.tenant_id.is_(None)))
        elif status_filter:
            query = query.filter(SchoolSubscription.status == status_filter)
        if q_text and q_text.strip():
            like = f"%{q_text.strip().lower()}%"
            query = query.filter(or_(func.lower(Tenant.name).like(like), func.lower(Tenant.code).like(like),
                                     func.lower(Tenant.domain).like(like)))
        total = query.count()
        rows = query.order_by(Tenant.name).offset((page - 1) * page_size).limit(page_size).all()
        return {"items": [self._school_row(t, s) for t, s in rows], "total": total, "page": page,
                "page_size": page_size}

    def school_detail(self, tenant_id) -> Dict[str, Any]:
        tenant = self.school(tenant_id)
        sub = self.db.query(SchoolSubscription).filter(SchoolSubscription.tenant_id == tenant.id).first()
        row = self._school_row(tenant, sub)
        price = self.price_in_force(today())
        semester = self.current_semester(tenant.id, today())
        row.update({
            "subscription": self.subscription_out(tenant.id),
            "usage": self.usage_by_month(tenant.id),
            "current_semester": ({"id": semester.id, "name": semester.name, "start_date": semester.start_date,
                                  "end_date": semester.end_date} if semester else None),
            "semesters": [{"id": s.id, "name": s.name, "start_date": s.start_date, "end_date": s.end_date}
                          for s in self._semesters(tenant.id)],
            "price_in_force": self._price_out(price, current_id=price.id) if price else None,
            "invoices": [self.invoice_detail(i.id) for i in self._invoices(tenant.id)],
        })
        return row

    def list_invoices(self, *, status_filter: Optional[str] = None, date_from: Optional[date] = None,
                      date_to: Optional[date] = None, page: int = 1, page_size: int = 25) -> Dict[str, Any]:
        query = self.db.query(PlatformInvoice)
        if status_filter in ("issued", "void"):
            query = query.filter(PlatformInvoice.status == status_filter)
        elif status_filter not in (None, "all", "owing", "paid"):
            raise _422("status must be all, issued, void, owing or paid")
        if date_from:
            query = query.filter(PlatformInvoice.issued_at >= datetime.combine(date_from, time.min, TIMEZONE))
        if date_to:
            query = query.filter(PlatformInvoice.issued_at < datetime.combine(date_to + timedelta(days=1), time.min, TIMEZONE))
        invoices = query.order_by(PlatformInvoice.issued_at.desc()).all()
        amounts = self.amounts(invoices)
        if status_filter in ("owing", "paid"):
            invoices = [i for i in invoices if i.status == "issued" and amounts[i.id]["owing"] == (status_filter == "owing")]
        total = len(invoices)
        page_rows = invoices[(page - 1) * page_size: page * page_size]
        sems = self._semester_names(i.semester_id for i in page_rows)
        names = {t.id: t.name for t in self.db.query(Tenant.id, Tenant.name).filter(
            Tenant.id.in_([i.tenant_id for i in page_rows] or [None]))}
        items = []
        for i in page_rows:
            row = self._invoice_row(i, amounts[i.id], sems)
            row["school_name"] = names.get(i.tenant_id)
            items.append(row)
        return {"items": items, "total": total, "page": page, "page_size": page_size}

    def summary(self) -> Dict[str, Any]:
        """Platform totals per currency. An invoice counts as billed in a currency once its first
        payment fixes it; until then it is under not_yet_paid in both."""
        invoices = self.db.query(PlatformInvoice).filter(PlatformInvoice.status == "issued").all()
        amounts = self.amounts(invoices)
        billed, outstanding = defaultdict(lambda: ZERO), defaultdict(lambda: ZERO)
        unpaid = {"invoices": 0, "USD": ZERO, "LRD": ZERO}
        for inv in invoices:
            a = amounts[inv.id]
            if inv.currency:
                billed[inv.currency] += a["total"][inv.currency]
                outstanding[inv.currency] += a["balance"][inv.currency]
            elif a["charged"]:
                unpaid["invoices"] += 1
                for c in CURRENCIES:
                    unpaid[c] += a["total"][c]
        collected = {c: q(v) for c, v in self.db.query(PlatformPayment.currency, func.sum(PlatformPayment.amount))
                     .filter(PlatformPayment.voided_at.is_(None)).group_by(PlatformPayment.currency)}
        schools = {s: 0 for s in SUBSCRIPTION_STATUSES}
        for st, n in (self.db.query(func.coalesce(SchoolSubscription.status, "trial"), func.count(Tenant.id))
                      .select_from(Tenant).outerjoin(SchoolSubscription, SchoolSubscription.tenant_id == Tenant.id)
                      .group_by(func.coalesce(SchoolSubscription.status, "trial"))):
            schools[st] = n
        return {"billed": money_map(billed), "collected": money_map(collected), "outstanding": money_map(outstanding),
                "not_yet_paid": {"invoices": unpaid["invoices"], "USD": money(unpaid["USD"]), "LRD": money(unpaid["LRD"])},
                "schools": schools}

    def collected_usd_since(self, since: datetime) -> Dict[UUID, Decimal]:
        """USD received per school since a moment (the platform dashboards' revenue figures)."""
        return {t: q(v) for t, v in self.db.query(PlatformPayment.tenant_id, func.sum(PlatformPayment.amount)).filter(
            PlatformPayment.voided_at.is_(None), PlatformPayment.currency == "USD",
            PlatformPayment.received_at >= since).group_by(PlatformPayment.tenant_id)}


def _is_platform(user) -> bool:
    from src.core.security.auth import is_super_admin
    return user is not None and is_super_admin(user)


def banner_for(status: str, oldest_due: Optional[date], on: date) -> str:
    """none, due_soon, overdue, read_only, suspended or dormant."""
    if status in ("read_only", "suspended", "dormant"):
        return status
    if oldest_due is None:
        return "none"
    if oldest_due < on:
        return "overdue"
    return "due_soon" if (oldest_due - on).days <= DUE_SOON_DAYS else "none"


def status_message(banner: str, amount_due: Dict[str, Decimal], oldest_due: Optional[date],
                   read_only_on: Optional[date], admin: bool) -> Optional[str]:
    """The banner's line, and the text of the 403 that read-only and suspended schools get."""
    amount = amount_text(amount_due)
    if banner == "suspended":
        return (f"Your school's account is suspended: {amount} is overdue. Pay it to restore access; you can still "
                f"export the school's data." if admin else
                "Your school's account is suspended. Ask the school office.")
    if banner == "read_only":
        return (f"Your school's account is read-only: {amount} is overdue. Pay it to restore access." if admin else
                "Your school's account is read-only. Ask the school office.")
    if banner == "dormant":
        return ("Your school's account is dormant: you can view and export its data. Contact the platform to "
                "reactivate it." if admin else "Your school's account is read-only. Ask the school office.")
    if banner == "overdue":
        return (f"{amount} has been overdue since {_day(oldest_due)}. The account becomes read-only on "
                f"{_day(read_only_on)}." if admin else "Your school's subscription payment is overdue. Ask the school office.")
    if banner == "due_soon":
        return (f"Your school's platform invoice of {amount} is due on {_day(oldest_due)}." if admin else None)
    return None


# --- how to pay ------------------------------------------------------------------------------------

PAYMENT_DETAILS_MAX = 2000


def payment_details(db: Session) -> Dict[str, Any]:
    """What schools see under "How to pay": the operator's text, or null while none is set."""
    from src.db.models.billing import PlatformPaymentDetails
    row = db.query(PlatformPaymentDetails).filter(PlatformPaymentDetails.id == 1).first()
    text_ = (row.instructions or "").strip() if row else ""
    return {"instructions": text_ or None, "updated_at": row.updated_at if row and text_ else None}


def set_payment_details(db: Session, instructions: Optional[str], user) -> Dict[str, Any]:
    from src.db.models.billing import PlatformPaymentDetails
    text_ = (instructions or "").strip()
    if len(text_) > PAYMENT_DETAILS_MAX:
        raise HTTPException(status_code=http.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"Keep the payment details under {PAYMENT_DETAILS_MAX} characters")
    row = db.query(PlatformPaymentDetails).filter(PlatformPaymentDetails.id == 1).first()
    if row is None:
        row = PlatformPaymentDetails(id=1)
        db.add(row)
    row.instructions = text_ or None
    row.updated_by = getattr(user, "id", None)
    row.updated_at = datetime.now(UTC)
    db.flush()
    return payment_details(db)

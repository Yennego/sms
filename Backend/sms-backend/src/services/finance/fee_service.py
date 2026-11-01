"""School fees (docs/remodel/phase5-design.md): setup, invoices, accounts, payments with receipts,
voids, adjustments, reports, the family view and the report-card hold.

Rules:
- every lookup filters by the request's school; ids from another school are 404;
- money is Decimal and leaves the API as strings with two decimals ("120.00");
- balances are calculated (ledger.py), never stored;
- recording a payment locks the student's account row and the school's receipt counter
  (SELECT ... FOR UPDATE), so two cashiers can't race and receipt numbers are never reused or
  skipped (the counter moves in the payment's own transaction);
- "same day" uses the school's time zone (attendance settings; Africa/Monrovia by default);
- changes are flushed only: the request commits once.
"""
import logging
from collections import defaultdict
from datetime import date, datetime, time, timedelta, UTC
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Iterable, List, Optional, Tuple
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from src.core.security.auth import is_super_admin
from src.db.models.academics.academic_grade import AcademicGrade
from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.class_model import Class
from src.db.models.academics.enrollment import Enrollment
from src.db.models.academics.semester import Semester
from src.db.models.auth.user import User
from src.db.models.finance.fee_category import FeeCategory
from src.db.models.finance.fees import (
    ADJUSTMENT_KINDS, PAYMENT_METHODS, FeeAdjustment, FeeSchedule, FinanceSettings, InstallmentPlan, Invoice,
    InvoiceLine, Payment, PaymentAllocation, ReceiptCounter, StudentFeeAccount,
)
from src.db.models.people.student import Student
from src.services.finance import ledger as L
from src.services.finance.ledger import CURRENCIES, ZERO, money, money_map, q
from src.services.notification import alerts

logger = logging.getLogger(__name__)

DEFAULT_TIMEZONE = "Africa/Monrovia"
MAX_PAGE_SIZE = 100
ACCOUNT_STATUSES = ("all", "owing", "overdue", "paid")
ACCOUNT_SORTS = ("name", "admission_number", "class", "balance", "overdue", "last_payment")
FAMILY_PAYMENT_FIELDS = ("id", "receipt_number", "received_at", "amount", "currency", "method", "reference",
                         "voided_at")
HOLD_MESSAGE = "This report card is held until school fees are paid. Please contact the school office."


def _now() -> datetime:
    """Current time (UTC). Tests replace it to fix "today"."""
    return datetime.now(UTC)


def _404(what: str):
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} not found")


def _422(detail: Any):
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


def _409(detail: Any):
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def _403(detail: str):
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def _uuid(value) -> Optional[UUID]:
    if value is None or isinstance(value, UUID):
        return value
    return UUID(str(value))


def _name(user) -> Optional[str]:
    if user is None:
        return None
    return f"{user.first_name or ''} {user.last_name or ''}".strip() or getattr(user, "username", None)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)  # SQLite returns naive UTC


def _amount(value, field: str, *, allow_zero: bool = True) -> Optional[Decimal]:
    """A money input: at most 2 decimals, not negative (or positive when allow_zero is False)."""
    if value is None:
        return None
    try:
        d = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise _422(f"{field} is not an amount")
    if not d.is_finite() or d != d.quantize(L.CENT):
        raise _422(f"{field} can have at most 2 decimals")
    if d < 0 or (not allow_zero and d == 0):
        raise _422(f"{field} must be {'0 or more' if allow_zero else 'more than 0'}")
    if d >= Decimal("10000000000"):
        raise _422(f"{field} is too large")
    return q(d)


def school_timezone(db: Session, tenant_id) -> ZoneInfo:
    from src.db.models.academics.daily_attendance import AttendanceSettings
    row = db.query(AttendanceSettings.timezone).filter(AttendanceSettings.tenant_id == _uuid(tenant_id)).first()
    try:
        return ZoneInfo(row[0] if row and row[0] else DEFAULT_TIMEZONE)
    except Exception:  # an unknown zone name: fall back rather than fail every request
        return ZoneInfo(DEFAULT_TIMEZONE)


_ONES = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen "
         "sixteen seventeen eighteen nineteen").split()
_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
_CURRENCY_WORDS = {"USD": ("United States dollar", "United States dollars"), "LRD": ("Liberian dollar", "Liberian dollars")}


def _words(n: int) -> str:
    if n < 20:
        return _ONES[n]
    if n < 100:
        return _TENS[n // 10] + ("-" + _ONES[n % 10] if n % 10 else "")
    if n < 1000:
        return _ONES[n // 100] + " hundred" + (" and " + _words(n % 100) if n % 100 else "")
    for size, name in ((10 ** 9, "billion"), (10 ** 6, "million"), (1000, "thousand")):
        if n >= size:
            rest = n % size
            return _words(n // size) + " " + name + ((" and " if rest < 100 else " ") + _words(rest) if rest else "")
    return str(n)


def amount_in_words(amount, currency: str) -> str:
    """Receipt wording, e.g. "One hundred United States dollars and fifty cents"."""
    value = q(amount)
    whole, cents = int(value), int((value - int(value)) * 100)
    one, many = _CURRENCY_WORDS.get(currency, (currency, currency))
    text = f"{_words(whole)} {one if whole == 1 else many}"
    if cents:
        text += f" and {_words(cents)} cent{'' if cents == 1 else 's'}"
    return text[0].upper() + text[1:]


def user_permissions(user: Any) -> set:
    return {p.name for role in getattr(user, "roles", []) for p in role.permissions}


def mark_next_due(installments: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """The earliest installment that isn't paid or overdue yet becomes "due" (the next to pay)."""
    upcoming = [i for i in installments if i["status"] == "upcoming"]
    if not upcoming:
        return None
    nxt = min(upcoming, key=lambda i: (i["due_date"], i.get("semester_number") or 0, i["sequence"]))
    nxt["status"] = "due"
    return nxt


class FeeService:
    def __init__(self, db: Session, tenant_id, user: Any):
        self.db = db
        self.tenant_id = _uuid(tenant_id)
        self.user = user
        self.super = is_super_admin(user) if user is not None else False
        self.perms = user_permissions(user)
        self._tz = None

    # --- access and time -----------------------------------------------------------------------

    def can(self, permission: str) -> bool:
        return self.super or permission in self.perms

    def require(self, permission: str) -> None:
        if not self.can(permission):
            raise _403(f"User does not have permission: {permission}")

    @property
    def tz(self) -> ZoneInfo:
        if self._tz is None:
            self._tz = school_timezone(self.db, self.tenant_id)
        return self._tz

    def today(self) -> date:
        return _now().astimezone(self.tz).date()

    def local_date(self, dt: datetime) -> date:
        return _aware(dt).astimezone(self.tz).date()

    def _day_bounds(self, start: Optional[date], end: Optional[date]) -> Tuple[Optional[datetime], Optional[datetime]]:
        lo = datetime.combine(start, time.min, self.tz).astimezone(UTC) if start else None
        hi = datetime.combine(end + timedelta(days=1), time.min, self.tz).astimezone(UTC) if end else None
        return lo, hi

    # --- lookups (always scoped to the school) --------------------------------------------------

    def _get(self, model, id_, what):
        obj = self.db.query(model).filter(model.tenant_id == self.tenant_id, model.id == _uuid(id_)).first()
        if obj is None:
            raise _404(what)
        return obj

    def year(self, academic_year_id=None) -> AcademicYear:
        query = self.db.query(AcademicYear).filter(AcademicYear.tenant_id == self.tenant_id)
        year = (query.filter(AcademicYear.id == _uuid(academic_year_id)) if academic_year_id
                else query.filter(AcademicYear.is_current == True)).first()  # noqa: E712
        if year is None:
            raise _404("School year" if academic_year_id else "Current school year")
        return year

    def semester_in_year(self, semester_id, year: AcademicYear) -> Semester:
        semester = self._get(Semester, semester_id, "Semester")
        if semester.academic_year_id != year.id:
            raise _422("The semester is not in this school year")
        return semester

    def student(self, student_id) -> Student:
        student = self.db.query(Student).filter(
            Student.tenant_id == self.tenant_id, Student.id == _uuid(student_id)).first()
        if student is None:
            raise _404("Student")
        return student

    def _users(self, ids: Iterable) -> Dict[UUID, User]:
        ids = {i for i in ids if i is not None}
        if not ids:
            return {}
        return {u.id: u for u in self.db.query(User).filter(User.id.in_(ids))}

    def _semesters(self, year_id) -> Dict[UUID, Semester]:
        return {s.id: s for s in self.db.query(Semester).filter(
            Semester.tenant_id == self.tenant_id, Semester.academic_year_id == year_id)}

    def _account_query(self, student_id, year_id, *, lock: bool = False):
        query = self.db.query(StudentFeeAccount).filter(
            StudentFeeAccount.tenant_id == self.tenant_id, StudentFeeAccount.student_id == _uuid(student_id),
            StudentFeeAccount.academic_year_id == _uuid(year_id))
        return query.with_for_update() if lock else query

    def _account(self, student_id, year_id, *, lock: bool = False) -> Optional[StudentFeeAccount]:
        return self._account_query(student_id, year_id, lock=lock).first()

    def _get_or_create_account(self, student_id, year_id) -> StudentFeeAccount:
        account = self._account(student_id, year_id)
        if account is None:
            account = StudentFeeAccount(tenant_id=self.tenant_id, student_id=_uuid(student_id), academic_year_id=year_id,
                                        report_card_hold_override=False)
            self.db.add(account)
            self.db.flush()
        return account

    def _enrollment_info(self, year_id, student_ids=None) -> Dict[UUID, Dict[str, Any]]:
        """Each student's class this school year (one enrollment per student and year)."""
        query = (self.db.query(Enrollment.student_id, Enrollment.class_id, Enrollment.grade_id, Class.name,
                               AcademicGrade.name, AcademicGrade.sequence)
                 .outerjoin(Class, and_(Class.id == Enrollment.class_id, Class.tenant_id == Enrollment.tenant_id))
                 .outerjoin(AcademicGrade, and_(AcademicGrade.id == Enrollment.grade_id,
                                                AcademicGrade.tenant_id == Enrollment.tenant_id))
                 .filter(Enrollment.tenant_id == self.tenant_id, Enrollment.academic_year_id == year_id))
        if student_ids is not None:
            query = query.filter(Enrollment.student_id.in_(list(student_ids) or [None]))
        return {sid: {"class_id": cid, "grade_id": gid, "class_name": cname, "grade_name": gname, "grade_sequence": gseq}
                for sid, cid, gid, cname, gname, gseq in query.all()}

    # --- settings -------------------------------------------------------------------------------

    def _settings_row(self) -> Optional[FinanceSettings]:
        return self.db.query(FinanceSettings).filter(FinanceSettings.tenant_id == self.tenant_id).first()

    def settings(self) -> Dict[str, Any]:
        row = self._settings_row()
        return {"hold_report_cards_on_arrears": bool(row.hold_report_cards_on_arrears) if row else False,
                "school_today": self.today()}

    def update_settings(self, hold: bool) -> Dict[str, Any]:
        row = self._settings_row()
        if row is None:
            row = FinanceSettings(tenant_id=self.tenant_id)
            self.db.add(row)
        row.hold_report_cards_on_arrears = bool(hold)
        self.db.flush()
        return self.settings()

    # --- categories -----------------------------------------------------------------------------

    def _category_out(self, c: FeeCategory, in_use: bool = False) -> Dict[str, Any]:
        return {"id": c.id, "name": c.name, "description": c.description, "is_active": bool(c.is_active),
                "in_use": in_use, "created_at": c.created_at, "updated_at": c.updated_at}

    def _categories_in_use(self) -> set:
        used = {r[0] for r in self.db.query(FeeSchedule.category_id).filter(FeeSchedule.tenant_id == self.tenant_id).distinct()}
        used |= {r[0] for r in self.db.query(InvoiceLine.category_id).filter(InvoiceLine.tenant_id == self.tenant_id).distinct()}
        return used

    def list_categories(self) -> List[Dict[str, Any]]:
        used = self._categories_in_use()
        rows = self.db.query(FeeCategory).filter(FeeCategory.tenant_id == self.tenant_id).order_by(func.lower(FeeCategory.name))
        return [self._category_out(c, c.id in used) for c in rows]

    def _check_category_name(self, name: str, current_id=None) -> str:
        name = (name or "").strip()
        if not name:
            raise _422("name is required")
        query = self.db.query(FeeCategory.id).filter(
            FeeCategory.tenant_id == self.tenant_id, func.lower(FeeCategory.name) == name.lower())
        if current_id is not None:
            query = query.filter(FeeCategory.id != current_id)
        if query.first():
            raise _409(f"A fee category named {name} already exists")
        return name

    def create_category(self, data: Dict[str, Any]) -> Dict[str, Any]:
        c = FeeCategory(tenant_id=self.tenant_id, name=self._check_category_name(data.get("name")),
                        description=data.get("description"), is_active=data.get("is_active", True) is not False)
        self.db.add(c)
        self.db.flush()
        return self._category_out(c)

    def update_category(self, category_id, data: Dict[str, Any]) -> Dict[str, Any]:
        c = self._get(FeeCategory, category_id, "Fee category")
        if "name" in data and data["name"] is not None:
            c.name = self._check_category_name(data["name"], c.id)
        if "description" in data:
            c.description = data["description"]
        if data.get("is_active") is not None:
            c.is_active = bool(data["is_active"])
        self.db.flush()
        return self._category_out(c, c.id in self._categories_in_use())

    def delete_category(self, category_id) -> Dict[str, Any]:
        c = self._get(FeeCategory, category_id, "Fee category")
        if c.id in self._categories_in_use():
            raise _409("This category is used by fee schedules or invoices. Switch it off instead.")
        self.db.delete(c)
        self.db.flush()
        return {"deleted": True, "id": c.id}

    # --- schedules ------------------------------------------------------------------------------

    def _invoiced_schedule_ids(self, ids=None) -> set:
        query = self.db.query(InvoiceLine.schedule_id).filter(
            InvoiceLine.tenant_id == self.tenant_id, InvoiceLine.schedule_id.isnot(None))
        if ids is not None:
            query = query.filter(InvoiceLine.schedule_id.in_(list(ids) or [None]))
        return {r[0] for r in query.distinct()}

    def _schedule_out(self, s: FeeSchedule, names: Dict[str, Dict], invoiced: set) -> Dict[str, Any]:
        sem = names["semesters"].get(s.semester_id)
        grade = names["grades"].get(s.grade_id)
        cat = names["categories"].get(s.category_id)
        return {
            "id": s.id, "academic_year_id": s.academic_year_id, "semester_id": s.semester_id,
            "semester_name": sem.name if sem else None, "grade_id": s.grade_id,
            "grade_name": grade.name if grade else None, "category_id": s.category_id,
            "category_name": cat.name if cat else None, "amount_usd": money(s.amount_usd),
            "amount_lrd": money(s.amount_lrd), "invoiced": s.id in invoiced,
        }

    def _names(self) -> Dict[str, Dict]:
        t = self.tenant_id
        return {
            "semesters": {s.id: s for s in self.db.query(Semester).filter(Semester.tenant_id == t)},
            "grades": {g.id: g for g in self.db.query(AcademicGrade).filter(AcademicGrade.tenant_id == t)},
            "categories": {c.id: c for c in self.db.query(FeeCategory).filter(FeeCategory.tenant_id == t)},
        }

    def list_schedules(self, academic_year_id=None, semester_id=None, grade_id=None) -> List[Dict[str, Any]]:
        year = self.year(academic_year_id)
        query = self.db.query(FeeSchedule).filter(FeeSchedule.tenant_id == self.tenant_id,
                                                  FeeSchedule.academic_year_id == year.id)
        if semester_id:
            query = query.filter(FeeSchedule.semester_id == _uuid(semester_id))
        if grade_id:
            query = query.filter(FeeSchedule.grade_id == _uuid(grade_id))
        rows = query.all()
        names = self._names()
        invoiced = self._invoiced_schedule_ids([s.id for s in rows])

        def key(s):
            sem, grade, cat = (names["semesters"].get(s.semester_id), names["grades"].get(s.grade_id),
                               names["categories"].get(s.category_id))
            return (sem.semester_number if sem else 0, -1 if grade is None else grade.sequence,
                    (cat.name if cat else "").lower())
        return [self._schedule_out(s, names, invoiced) for s in sorted(rows, key=key)]

    def _schedule_fields(self, data: Dict[str, Any], current: Optional[FeeSchedule] = None) -> Dict[str, Any]:
        def pick(name):
            return data[name] if name in data else (getattr(current, name) if current is not None else None)
        year = self.year(pick("academic_year_id")) if pick("academic_year_id") else None
        if year is None:
            raise _422("academic_year_id is required")
        semester = self.semester_in_year(pick("semester_id"), year)
        grade_id = pick("grade_id")
        if grade_id:
            self._get(AcademicGrade, grade_id, "Grade level")
        category = self._get(FeeCategory, pick("category_id"), "Fee category")
        usd = _amount(pick("amount_usd"), "amount_usd")
        lrd = _amount(pick("amount_lrd"), "amount_lrd")
        if usd is None and lrd is None:
            raise _422("Give an amount in USD, LRD or both")
        return {"academic_year_id": year.id, "semester_id": semester.id, "grade_id": _uuid(grade_id) if grade_id else None,
                "category_id": category.id, "amount_usd": usd, "amount_lrd": lrd, "_category": category}

    def _check_schedule_unique(self, f: Dict[str, Any], current_id=None) -> None:
        query = self.db.query(FeeSchedule.id).filter(
            FeeSchedule.tenant_id == self.tenant_id, FeeSchedule.academic_year_id == f["academic_year_id"],
            FeeSchedule.semester_id == f["semester_id"], FeeSchedule.category_id == f["category_id"],
            FeeSchedule.grade_id == f["grade_id"] if f["grade_id"] else FeeSchedule.grade_id.is_(None))
        if current_id is not None:
            query = query.filter(FeeSchedule.id != current_id)
        if query.first():
            raise _409("This fee is already scheduled for that semester and grade level")

    def create_schedule(self, data: Dict[str, Any]) -> Dict[str, Any]:
        f = self._schedule_fields(data)
        if not f["_category"].is_active:
            raise _422("This fee category is switched off")
        self._check_schedule_unique(f)
        f.pop("_category")
        s = FeeSchedule(tenant_id=self.tenant_id, **f)
        self.db.add(s)
        self.db.flush()
        return self._schedule_out(s, self._names(), set())

    def update_schedule(self, schedule_id, data: Dict[str, Any]) -> Dict[str, Any]:
        s = self._get(FeeSchedule, schedule_id, "Fee schedule")
        f = self._schedule_fields(data, s)
        f.pop("_category")
        invoiced = s.id in self._invoiced_schedule_ids([s.id])
        if invoiced and any(f[k] != getattr(s, k) for k in ("academic_year_id", "semester_id", "grade_id", "category_id")):
            raise _409("This fee is already on invoices: only its amounts can change (for invoices issued from now on)")
        self._check_schedule_unique(f, s.id)
        for k, v in f.items():
            setattr(s, k, v)
        self.db.flush()
        return self._schedule_out(s, self._names(), {s.id} if invoiced else set())

    def delete_schedule(self, schedule_id) -> Dict[str, Any]:
        s = self._get(FeeSchedule, schedule_id, "Fee schedule")
        if s.id in self._invoiced_schedule_ids([s.id]):
            raise _409("This fee is already on invoices and can't be deleted")
        self.db.delete(s)
        self.db.flush()
        return {"deleted": True, "id": s.id}

    # --- installment plans ----------------------------------------------------------------------

    def _plans(self, year_id) -> Dict[UUID, List[InstallmentPlan]]:
        out = defaultdict(list)
        for p in self.db.query(InstallmentPlan).filter(
                InstallmentPlan.tenant_id == self.tenant_id, InstallmentPlan.academic_year_id == year_id
        ).order_by(InstallmentPlan.sequence):
            out[p.semester_id].append(p)
        return out

    def _plan_out(self, sem: Semester, plan: List[InstallmentPlan]) -> Dict[str, Any]:
        return {
            "semester_id": sem.id, "semester_name": sem.name, "semester_number": sem.semester_number,
            "academic_year_id": sem.academic_year_id, "start_date": sem.start_date, "end_date": sem.end_date,
            "installments": [{"id": p.id, "sequence": p.sequence, "due_date": p.due_date, "percent": money(p.percent)}
                             for p in plan],
            "total_percent": money(sum((Decimal(p.percent) for p in plan), ZERO)),
            # with no plan, the whole bill falls due at the semester's end
            "default_due_date": sem.end_date,
        }

    def list_plans(self, academic_year_id=None, semester_id=None) -> List[Dict[str, Any]]:
        year = self.year(academic_year_id)
        plans = self._plans(year.id)
        sems = sorted(self._semesters(year.id).values(), key=lambda s: s.semester_number)
        if semester_id:
            sems = [s for s in sems if s.id == _uuid(semester_id)]
        return [self._plan_out(s, plans.get(s.id, [])) for s in sems]

    def replace_plan(self, semester_id, installments: List[Dict[str, Any]], academic_year_id=None) -> Dict[str, Any]:
        sem = self._get(Semester, semester_id, "Semester")
        if academic_year_id and _uuid(academic_year_id) != sem.academic_year_id:
            raise _422("The semester is not in this school year")
        items = []
        for i, item in enumerate(installments or []):
            due = item.get("due_date")
            if isinstance(due, str):
                try:
                    due = date.fromisoformat(due)
                except ValueError:
                    raise _422(f"Installment {i + 1}: due_date is not a date")
            if not isinstance(due, date):
                raise _422(f"Installment {i + 1}: due_date is required")
            pct = _amount(item.get("percent"), f"Installment {i + 1}: percent", allow_zero=False)
            if pct is None or pct > 100:
                raise _422(f"Installment {i + 1}: percent must be more than 0 and at most 100")
            items.append((due, pct))
        items.sort(key=lambda x: x[0])
        if len({d for d, _ in items}) != len(items):
            raise _422("Two installments have the same due date")
        if items and sum((p for _, p in items), ZERO) != Decimal("100.00"):
            raise _422("The installments' percents must add up to 100")
        self.db.query(InstallmentPlan).filter(InstallmentPlan.tenant_id == self.tenant_id,
                                              InstallmentPlan.semester_id == sem.id).delete(synchronize_session=False)
        self.db.flush()
        rows = [InstallmentPlan(tenant_id=self.tenant_id, academic_year_id=sem.academic_year_id, semester_id=sem.id,
                                sequence=n, due_date=d, percent=p) for n, (d, p) in enumerate(items, start=1)]
        self.db.add_all(rows)
        self.db.flush()
        return self._plan_out(sem, rows)

    # --- ledger ---------------------------------------------------------------------------------

    def _ledger(self, year_id, account_ids=None) -> Dict[str, Any]:
        """Load what the balances of a year's accounts (or some of them) are calculated from."""
        t = self.tenant_id
        sems = self._semesters(year_id)
        plans = self._plans(year_id)
        accounts_q = self.db.query(StudentFeeAccount).filter(StudentFeeAccount.tenant_id == t,
                                                             StudentFeeAccount.academic_year_id == year_id)
        if account_ids is not None:
            accounts_q = accounts_q.filter(StudentFeeAccount.id.in_(list(account_ids) or [None]))
        accounts = {a.id: a for a in accounts_q}
        acc_sub = select(StudentFeeAccount.id).where(StudentFeeAccount.tenant_id == t,
                                                     StudentFeeAccount.academic_year_id == year_id)
        if account_ids is not None:
            acc_sub = acc_sub.where(StudentFeeAccount.id.in_(list(account_ids) or [None]))
        invoices = self.db.query(Invoice).filter(Invoice.tenant_id == t, Invoice.account_id.in_(acc_sub)).all()
        inv_sub = select(Invoice.id).where(Invoice.tenant_id == t, Invoice.account_id.in_(acc_sub))
        lines = defaultdict(list)
        for line in self.db.query(InvoiceLine).filter(InvoiceLine.tenant_id == t, InvoiceLine.invoice_id.in_(inv_sub)) \
                .order_by(InvoiceLine.created_at):
            lines[line.invoice_id].append(line)
        adjustments = defaultdict(list)
        for adj in self.db.query(FeeAdjustment).filter(FeeAdjustment.tenant_id == t, FeeAdjustment.invoice_id.in_(inv_sub)) \
                .order_by(FeeAdjustment.created_at):
            adjustments[adj.invoice_id].append(adj)
        paid = defaultdict(lambda: ZERO)
        for invoice_id, amount in (self.db.query(PaymentAllocation.invoice_id, PaymentAllocation.amount)
                                   .join(Payment, and_(Payment.id == PaymentAllocation.payment_id, Payment.tenant_id == t))
                                   .filter(PaymentAllocation.tenant_id == t, PaymentAllocation.invoice_id.in_(inv_sub),
                                           Payment.voided_at.is_(None))):
            paid[invoice_id] = q(paid[invoice_id] + q(amount))

        def plan_for(sem_id):
            rows = plans.get(sem_id)
            if rows:
                return [L.Installment(p.sequence, p.due_date, Decimal(p.percent)) for p in rows]
            sem = sems.get(sem_id)
            return [L.Installment(1, sem.end_date, Decimal(100))] if sem else []

        inv_calcs, by_account = {}, defaultdict(list)
        for inv in invoices:
            calc = L.InvoiceCalc(
                lines=[L.Line(l.amount_usd, l.amount_lrd) for l in lines[inv.id]],
                adjustments=[L.Adjustment(a.percent, a.amount_usd, a.amount_lrd) for a in adjustments[inv.id]],
                paid=paid[inv.id], plan=plan_for(inv.semester_id))
            inv_calcs[inv.id] = calc
            by_account[inv.account_id].append(inv)
        order = lambda inv: (sems[inv.semester_id].semester_number if inv.semester_id in sems else 99, inv.issued_at)  # noqa: E731
        for invs in by_account.values():
            invs.sort(key=order)
        calcs = {a_id: L.AccountCalc(a.currency, [inv_calcs[i.id] for i in by_account[a_id] if i.status == "issued"])
                 for a_id, a in accounts.items()}
        return {"accounts": accounts, "calcs": calcs, "invoices": by_account, "inv_calcs": inv_calcs,
                "lines": lines, "adjustments": adjustments, "paid": paid, "semesters": sems, "plans": plans}

    def _last_payments(self, year_id) -> Dict[UUID, datetime]:
        rows = (self.db.query(Payment.account_id, func.max(Payment.received_at))
                .join(StudentFeeAccount, and_(StudentFeeAccount.id == Payment.account_id,
                                              StudentFeeAccount.tenant_id == Payment.tenant_id))
                .filter(Payment.tenant_id == self.tenant_id, Payment.voided_at.is_(None),
                        StudentFeeAccount.academic_year_id == year_id)
                .group_by(Payment.account_id))
        return {a: _aware(at) for a, at in rows}

    # --- invoices -------------------------------------------------------------------------------

    def issue_invoices(self, academic_year_id, semester_id, grade_id=None, class_id=None,
                       student_ids=None) -> Dict[str, Any]:
        year = self.year(academic_year_id)
        semester = self.semester_in_year(semester_id, year)
        if grade_id:
            self._get(AcademicGrade, grade_id, "Grade level")
        if class_id:
            cls = self._get(Class, class_id, "Class")
            if cls.academic_year_id != year.id:
                raise _422("The class is not in this school year")
        categories = {c.id: c for c in self.db.query(FeeCategory).filter(FeeCategory.tenant_id == self.tenant_id)}
        schedules = [s for s in self.db.query(FeeSchedule).filter(
            FeeSchedule.tenant_id == self.tenant_id, FeeSchedule.academic_year_id == year.id,
            FeeSchedule.semester_id == semester.id).all()
            if categories.get(s.category_id) is not None and categories[s.category_id].is_active]
        if not schedules:
            raise _422("Set the fee schedule for this semester first")

        enr_q = (self.db.query(Enrollment)
                 .join(Student, and_(Student.id == Enrollment.student_id, Student.tenant_id == Enrollment.tenant_id))
                 .filter(Enrollment.tenant_id == self.tenant_id, Enrollment.academic_year_id == year.id,
                         Enrollment.status == "active"))
        if grade_id:
            enr_q = enr_q.filter(Enrollment.grade_id == _uuid(grade_id))
        if class_id:
            enr_q = enr_q.filter(Enrollment.class_id == _uuid(class_id))
        if student_ids is not None:
            enr_q = enr_q.filter(Enrollment.student_id.in_([_uuid(i) for i in student_ids] or [None]))
        enrollments = enr_q.all()
        student_ids = [e.student_id for e in enrollments]

        accounts = {a.student_id: a for a in self.db.query(StudentFeeAccount).filter(
            StudentFeeAccount.tenant_id == self.tenant_id, StudentFeeAccount.academic_year_id == year.id,
            StudentFeeAccount.student_id.in_(student_ids or [None]))}
        invoices = {i.account_id: i for i in self.db.query(Invoice).filter(
            Invoice.tenant_id == self.tenant_id, Invoice.semester_id == semester.id,
            Invoice.account_id.in_([a.id for a in accounts.values()] or [None]))}
        on_invoice = defaultdict(set)
        for invoice_id, schedule_id in self.db.query(InvoiceLine.invoice_id, InvoiceLine.schedule_id).filter(
                InvoiceLine.tenant_id == self.tenant_id, InvoiceLine.invoice_id.in_([i.id for i in invoices.values()] or [None])):
            on_invoice[invoice_id].add(schedule_id)
        names = {s.id: f"{s.first_name} {s.last_name}" for s in self.db.query(Student).filter(
            Student.tenant_id == self.tenant_id, Student.id.in_(student_ids or [None]))}

        result = {"students": len(enrollments), "invoices_created": 0, "invoices_updated": 0, "lines_added": 0,
                  "unchanged": 0, "skipped_void": 0, "no_schedule": 0, "problems": []}
        now = _now()
        for e in enrollments:
            applicable = [s for s in schedules if s.grade_id is None or s.grade_id == e.grade_id]
            if not applicable:
                result["no_schedule"] += 1
                continue
            account = accounts.get(e.student_id)
            if account is None:
                account = StudentFeeAccount(tenant_id=self.tenant_id, student_id=e.student_id,
                                            academic_year_id=year.id, report_card_hold_override=False)
                self.db.add(account)
                self.db.flush()
                accounts[e.student_id] = account
            invoice = invoices.get(account.id)
            if invoice is not None and invoice.status == "void":
                result["skipped_void"] += 1
                continue
            new = [s for s in applicable if invoice is None or s.id not in on_invoice[invoice.id]]
            if not new:
                result["unchanged"] += 1
                continue
            if invoice is None:
                invoice = Invoice(tenant_id=self.tenant_id, account_id=account.id, semester_id=semester.id,
                                  status="issued", issued_at=now, issued_by=getattr(self.user, "id", None))
                self.db.add(invoice)
                self.db.flush()
                invoices[account.id] = invoice
                result["invoices_created"] += 1
            else:
                result["invoices_updated"] += 1
            for s in new:
                self.db.add(InvoiceLine(tenant_id=self.tenant_id, invoice_id=invoice.id, schedule_id=s.id,
                                        category_id=s.category_id, description=categories[s.category_id].name,
                                        amount_usd=s.amount_usd, amount_lrd=s.amount_lrd))
                on_invoice[invoice.id].add(s.id)
                result["lines_added"] += 1
                if account.currency and (s.amount_usd if account.currency == "USD" else s.amount_lrd) is None:
                    result["problems"].append({"student_id": e.student_id, "student_name": names.get(e.student_id),
                                               "detail":
                                               f"Pays in {account.currency}, but {categories[s.category_id].name} "
                                               f"has no {account.currency} amount"})
        self.db.flush()
        return result

    def bill_new_enrollment(self, student_ids, academic_year_id) -> int:
        """Bill students placed in a class after the school started billing (admission, placement,
        import): each semester of the year that already has invoices issued and hasn't ended gets
        the same invoice as their classmates, from their grade's schedule. Past semesters are never
        billed. Does nothing while the school's finance switch is off. Returns invoices created.
        Never raises: billing must not stop an admission; problems are logged."""
        from src.services.tenant.features import feature_enabled
        ids = [i for i in (student_ids or []) if i]
        if not ids or not feature_enabled(self.db, self.tenant_id, "enable_finance"):
            return 0
        today = self.today()
        billed_semesters = (self.db.query(Semester)
                            .join(Invoice, and_(Invoice.semester_id == Semester.id, Invoice.tenant_id == Semester.tenant_id))
                            .filter(Semester.tenant_id == self.tenant_id, Semester.academic_year_id == _uuid(academic_year_id),
                                    Semester.end_date >= today)
                            .distinct().all())
        created = 0
        savepoints = self.db.get_bind().dialect.name == "postgresql"  # as in notify(): SQLite tests run without
        for semester in sorted(billed_semesters, key=lambda x: x.start_date):
            try:
                if savepoints:
                    with self.db.begin_nested():
                        created += self.issue_invoices(academic_year_id, semester.id, student_ids=ids)["invoices_created"]
                else:
                    created += self.issue_invoices(academic_year_id, semester.id, student_ids=ids)["invoices_created"]
            except HTTPException as exc:  # e.g. no schedule for that semester any more
                logger.info("auto-billing skipped for semester %s: %s", semester.id, exc.detail)
            except Exception:
                logger.exception("auto-billing failed for semester %s", semester.id)
        return created

    def void_invoice(self, invoice_id, reason: str) -> Dict[str, Any]:
        invoice = self._get(Invoice, invoice_id, "Invoice")
        if invoice.status == "void":
            raise _409("This invoice is already void")
        if not (reason or "").strip():
            raise _422("Give a reason")
        allocated = (self.db.query(PaymentAllocation.id)
                     .join(Payment, and_(Payment.id == PaymentAllocation.payment_id, Payment.tenant_id == PaymentAllocation.tenant_id))
                     .filter(PaymentAllocation.tenant_id == self.tenant_id, PaymentAllocation.invoice_id == invoice.id,
                             Payment.voided_at.is_(None)).first())
        if allocated:
            raise _409("Payments are recorded against this invoice. Void those payments first.")
        invoice.status = "void"
        invoice.voided_at = _now()
        invoice.voided_by = getattr(self.user, "id", None)
        invoice.void_reason = reason.strip()
        self.db.flush()
        account = self.db.query(StudentFeeAccount).filter(StudentFeeAccount.id == invoice.account_id).one()
        return self.statement(account.student_id, account.academic_year_id)

    # --- adjustments ----------------------------------------------------------------------------

    def add_adjustment(self, invoice_id, data: Dict[str, Any]) -> Dict[str, Any]:
        invoice = self._get(Invoice, invoice_id, "Invoice")
        if invoice.status != "issued":
            raise _409("This invoice is void")
        kind = data.get("kind")
        if kind not in ADJUSTMENT_KINDS:
            raise _422("kind must be discount, scholarship or waiver")
        reason = (data.get("reason") or "").strip()
        if not reason:
            raise _422("Give a reason")
        percent = _amount(data.get("percent"), "percent", allow_zero=False)
        usd = _amount(data.get("amount_usd"), "amount_usd", allow_zero=False)
        lrd = _amount(data.get("amount_lrd"), "amount_lrd", allow_zero=False)
        if percent is not None and (usd is not None or lrd is not None):
            raise _422("Give a percent or amounts, not both")
        if percent is None and usd is None and lrd is None:
            raise _422("Give a percent or an amount")
        if percent is not None and percent > 100:
            raise _422("percent must be at most 100")

        account = self.db.query(StudentFeeAccount).filter(StudentFeeAccount.id == invoice.account_id).one()
        led = self._ledger(account.academic_year_id, [account.id])
        calc = led["inv_calcs"][invoice.id]
        currencies = [account.currency] if account.currency else calc.currencies()
        if percent is None:
            missing = [c for c in currencies if (usd if c == "USD" else lrd) is None]
            if missing:
                raise _422(f"Give the amount in {' and '.join(missing)}"
                           + ("" if account.currency else " (the student's currency isn't fixed until the first payment)"))
        trial = L.InvoiceCalc(calc.lines, calc.adjustments + [L.Adjustment(percent, usd, lrd)], calc.paid, calc.plan)
        for c in currencies:
            charged = trial.charged(c)
            if charged is not None and trial.adjusted(c) > charged:
                raise _409(f"The adjustments would be more than the invoice ({c} {money(charged)})")
            owed = trial.owed(c) or ZERO
            if trial.paid_in(c, account.currency) > owed:
                raise _409(f"{c} {money(trial.paid_in(c, account.currency))} is already paid on this invoice; "
                           f"the adjustment would leave it overpaid")
        adj = FeeAdjustment(tenant_id=self.tenant_id, invoice_id=invoice.id, kind=kind, percent=percent,
                            amount_usd=usd if percent is None else None, amount_lrd=lrd if percent is None else None,
                            reason=reason, approved_by=getattr(self.user, "id", None))
        self.db.add(adj)
        self.db.flush()
        return self.statement(account.student_id, account.academic_year_id)

    def delete_adjustment(self, adjustment_id) -> Dict[str, Any]:
        adj = self._get(FeeAdjustment, adjustment_id, "Adjustment")
        invoice = self.db.query(Invoice).filter(Invoice.id == adj.invoice_id).one()
        account = self.db.query(StudentFeeAccount).filter(StudentFeeAccount.id == invoice.account_id).one()
        self.db.delete(adj)
        self.db.flush()
        return self.statement(account.student_id, account.academic_year_id)

    # --- accounts -------------------------------------------------------------------------------

    def list_accounts(self, *, academic_year_id=None, class_id=None, status_filter: str = "all", q_text: Optional[str] = None,
                      sort: str = "name", page: int = 1, page_size: int = 25) -> Dict[str, Any]:
        if status_filter not in ACCOUNT_STATUSES:
            raise _422("status must be all, owing, overdue or paid")
        if sort not in ACCOUNT_SORTS:
            raise _422("sort must be " + ", ".join(ACCOUNT_SORTS))
        page = max(int(page), 1)
        page_size = min(max(int(page_size), 1), MAX_PAGE_SIZE)
        year = self.year(academic_year_id)
        enr = Enrollment
        query = (self.db.query(StudentFeeAccount, Student, enr.class_id, Class.name, AcademicGrade.sequence)
                 .join(Student, and_(Student.id == StudentFeeAccount.student_id, Student.tenant_id == StudentFeeAccount.tenant_id))
                 .outerjoin(enr, and_(enr.student_id == StudentFeeAccount.student_id, enr.tenant_id == StudentFeeAccount.tenant_id,
                                      enr.academic_year_id == year.id))
                 .outerjoin(Class, and_(Class.id == enr.class_id, Class.tenant_id == enr.tenant_id))
                 .outerjoin(AcademicGrade, and_(AcademicGrade.id == enr.grade_id, AcademicGrade.tenant_id == enr.tenant_id))
                 .filter(StudentFeeAccount.tenant_id == self.tenant_id, StudentFeeAccount.academic_year_id == year.id))
        if class_id:
            query = query.filter(enr.class_id == _uuid(class_id))
        if q_text and q_text.strip():
            term = f"%{q_text.strip().lower()}%"
            query = query.filter(or_(
                func.lower(func.concat(Student.first_name, " ", Student.last_name)).like(term),
                func.lower(func.concat(Student.last_name, " ", Student.first_name)).like(term),
                func.lower(Student.admission_number).like(term),
                func.lower(Student.username).like(term),
            ))
        rows = query.all()
        led = self._ledger(year.id, [r[0].id for r in rows]) if rows else {"calcs": {}}
        last = self._last_payments(year.id)
        today = self.today()

        entries, counts = [], {"all": 0, "owing": 0, "overdue": 0, "paid": 0}
        for account, student, cls_id, cls_name, grade_seq in rows:
            calc = led["calcs"][account.id]
            totals = calc.totals(today)
            flags = L.status_of(totals)
            counts["all"] += 1
            for k in ("owing", "overdue", "paid"):
                counts[k] += 1 if flags[k] else 0
            entries.append((account, student, cls_id, cls_name, grade_seq, calc, totals, flags))
        if status_filter != "all":
            entries = [e for e in entries if e[7][status_filter]]

        # Per currency, never mixed: an account counts in its currency (before the first payment: USD
        # when the bill is priced in USD, else LRD)
        sum_totals: Dict[str, Dict[str, Decimal]] = {"owed": {}, "paid": {}, "balance": {}, "overdue": {}}
        for account, student, *_rest, calc, totals, flags in entries:
            c = calc.primary_currency()
            if c is None:
                continue
            for k in sum_totals:
                L.add_into(sum_totals[k], {c: totals[k][c]})

        def name_key(e):
            s = e[1]
            return ((s.last_name or "").lower(), (s.first_name or "").lower(), str(s.id))

        def money_key(field):
            return lambda e: tuple(-(e[6][field].get(c, ZERO)) for c in CURRENCIES) + name_key(e)
        if sort == "admission_number":
            entries.sort(key=lambda e: (e[1].admission_number or "", str(e[1].id)))
        elif sort == "class":
            entries.sort(key=lambda e: (e[4] is None, e[4] or 0, (e[3] or "").lower()) + name_key(e))
        elif sort in ("balance", "overdue"):
            entries.sort(key=money_key(sort))
        elif sort == "last_payment":
            entries.sort(key=lambda e: (last.get(e[0].id) is None, -(last[e[0].id].timestamp()) if last.get(e[0].id) else 0) + name_key(e))
        else:
            entries.sort(key=name_key)

        total = len(entries)
        items = []
        for account, student, cls_id, cls_name, _seq, calc, totals, flags in entries[(page - 1) * page_size: page * page_size]:
            items.append({
                "student_id": student.id, "account_id": account.id,
                "name": f"{student.first_name} {student.last_name}", "admission_number": student.admission_number,
                "class_id": cls_id, "class_name": cls_name, "currency": account.currency,
                "currencies": calc.currencies(),
                "owed": money_map(totals["owed"]), "paid": money_map(totals["paid"]),
                "balance": money_map(totals["balance"]), "overdue": money_map(totals["overdue"]),
                "status": "overdue" if flags["overdue"] else ("owing" if flags["owing"] else ("paid" if flags["paid"] else "none")),
                "last_payment_at": last.get(account.id),
                "report_card_hold_override": bool(account.report_card_hold_override),
            })
        return {
            "academic_year": {"id": year.id, "name": year.name},
            "items": items, "total": total, "page": page, "page_size": page_size,
            "pages": (total + page_size - 1) // page_size, "counts": counts,
            "totals": {k: money_map(v) for k, v in sum_totals.items()},
        }

    def hold_info(self, account: Optional[StudentFeeAccount], overdue: Dict[str, Decimal]) -> Dict[str, Any]:
        setting = self.settings()["hold_report_cards_on_arrears"]
        override = bool(account.report_card_hold_override) if account else False
        return {"setting_on": setting, "override": override,
                "held": setting and not override and any(v > 0 for v in overdue.values())}

    def statement(self, student_id, academic_year_id=None) -> Dict[str, Any]:
        student = self.student(student_id)
        year = self.year(academic_year_id)
        info = self._enrollment_info(year.id, [student.id]).get(student.id, {})
        account = self._account(student.id, year.id)
        today = self.today()
        out = {
            "student": {"id": student.id, "name": f"{student.first_name} {student.last_name}",
                        "admission_number": student.admission_number, "class_id": info.get("class_id"),
                        "class_name": info.get("class_name"), "grade_name": info.get("grade_name")},
            "academic_year": {"id": year.id, "name": year.name},
            "account": None, "currencies": [], "owed": {}, "paid": {}, "balance": {}, "overdue": {},
            "invoices": [], "installments": [], "payments": [], "today": today,
        }
        if account is None:
            raise _404("Fee account for this school year")
        led = self._ledger(year.id, [account.id])
        calc = led["calcs"][account.id]
        currencies = calc.currencies()
        totals = calc.totals(today)
        out.update({
            "account": {"id": account.id, "currency": account.currency, "currency_locked_at": _aware(account.currency_locked_at),
                        "report_card_hold_override": bool(account.report_card_hold_override),
                        "academic_year_id": year.id, "academic_year_name": year.name},
            "currencies": currencies,
            "owed": money_map(totals["owed"]), "paid": money_map(totals["paid"]),
            "balance": money_map(totals["balance"]), "overdue": money_map(totals["overdue"]),
            "report_card_hold": self.hold_info(account, totals["overdue"]),
        })
        out["report_cards_held"] = out["report_card_hold"]["held"]
        cats = {c.id: c for c in self.db.query(FeeCategory).filter(FeeCategory.tenant_id == self.tenant_id)}
        invoices = led["invoices"].get(account.id, [])
        people = self._users([a.approved_by for i in invoices for a in led["adjustments"][i.id]]
                             + [i.issued_by for i in invoices] + [i.voided_by for i in invoices])
        sems = led["semesters"]
        primary = currencies[0] if currencies else None
        for inv in invoices:
            ic = led["inv_calcs"][inv.id]
            issued = inv.status == "issued"
            inv_cur = currencies if issued else ic.currencies()
            sem = sems.get(inv.semester_id)
            entry = {
                "id": inv.id, "semester_id": inv.semester_id, "semester_name": sem.name if sem else None,
                "semester_number": sem.semester_number if sem else None, "status": inv.status,
                "issued_at": _aware(inv.issued_at), "issued_by": inv.issued_by, "issued_by_name": _name(people.get(inv.issued_by)),
                "voided_at": _aware(inv.voided_at), "voided_by_name": _name(people.get(inv.voided_by)), "void_reason": inv.void_reason,
                "lines": [{"id": l.id, "schedule_id": l.schedule_id, "category_id": l.category_id,
                           "category_name": cats[l.category_id].name if l.category_id in cats else None,
                           "description": l.description, "amount_usd": money(l.amount_usd), "amount_lrd": money(l.amount_lrd)}
                          for l in led["lines"][inv.id]],
                "adjustments": [],
                "charged": money_map({c: ic.charged(c) for c in inv_cur if ic.charged(c) is not None}),
                "adjustments_total": money_map({c: ic.adjusted(c) for c in inv_cur}),
                "owed": money_map({c: ic.owed(c) or ZERO for c in inv_cur}) if issued else {},
                "paid": money_map({c: ic.paid_in(c, account.currency) for c in inv_cur}) if issued else {},
                "balance": money_map({c: q((ic.owed(c) or ZERO) - ic.paid_in(c, account.currency)) for c in inv_cur}) if issued else {},
                "overdue": money_map({c: ic.overdue(c, account.currency, today) for c in inv_cur}) if issued else {},
            }
            for a in led["adjustments"][inv.id]:
                one = L.Adjustment(a.percent, a.amount_usd, a.amount_lrd)
                entry["adjustments"].append({
                    "id": a.id, "kind": a.kind, "percent": money(a.percent), "amount_usd": money(a.amount_usd),
                    "amount_lrd": money(a.amount_lrd), "reason": a.reason, "approved_by": a.approved_by,
                    "approved_by_name": _name(people.get(a.approved_by)), "created_at": _aware(a.created_at),
                    "value": money_map({c: one.value(c, ic.charged(c)) for c in inv_cur if ic.charged(c) is not None}),
                })
            out["invoices"].append(entry)
            if issued and primary:
                per_cur = {c: ic.schedule(c, account.currency, today) for c in currencies}
                for n, inst in enumerate(per_cur[primary]):
                    out["installments"].append({
                        "invoice_id": inv.id, "semester_id": inv.semester_id, "semester_number": entry["semester_number"],
                        "semester_name": entry["semester_name"], "sequence": inst["sequence"], "due_date": inst["due_date"],
                        "percent": money(inst["percent"]),
                        "amount_due": money_map({c: per_cur[c][n]["amount"] for c in currencies}),
                        "due": money_map({c: per_cur[c][n]["amount"] for c in currencies}),
                        "paid": money_map({c: per_cur[c][n]["paid"] for c in currencies}),
                        "outstanding": money_map({c: per_cur[c][n]["remaining"] for c in currencies}),
                        "overdue": money_map({c: per_cur[c][n]["remaining"] if per_cur[c][n]["status"] == "overdue" else ZERO
                                              for c in currencies}),
                        "status": inst["status"],
                    })
        mark_next_due(out["installments"])
        payments = self.db.query(Payment).filter(Payment.tenant_id == self.tenant_id, Payment.account_id == account.id) \
            .order_by(Payment.received_at, Payment.receipt_seq).all()
        people = self._users([p.received_by for p in payments] + [p.voided_by for p in payments])
        out["payments"] = [self._payment_row(p, people=people, allocations=True, sems=sems) for p in payments]
        for row in out["payments"]:
            row.update({"student_id": student.id, "student_name": out["student"]["name"],
                        "admission_number": student.admission_number, "class_name": info.get("class_name"),
                        "academic_year_name": year.name})
        return out

    def reset_currency(self, student_id, academic_year_id) -> Dict[str, Any]:
        student = self.student(student_id)
        year = self.year(academic_year_id)
        account = self._account(student.id, year.id, lock=True)
        if account is None or account.currency is None:
            raise _409("This student's currency isn't fixed yet")
        valid = self.db.query(Payment.id).filter(Payment.tenant_id == self.tenant_id, Payment.account_id == account.id,
                                                 Payment.voided_at.is_(None)).first()
        if valid:
            raise _409("The student has payments that aren't void; the currency can't change")
        account.currency = None
        account.currency_locked_at = None
        self.db.flush()
        return self.statement(student.id, year.id)

    def set_hold_override(self, student_id, academic_year_id, allow: bool) -> Dict[str, Any]:
        student = self.student(student_id)
        year = self.year(academic_year_id)
        account = self._get_or_create_account(student.id, year.id)
        account.report_card_hold_override = bool(allow)
        self.db.flush()
        return self.statement(student.id, year.id)

    # --- payments -------------------------------------------------------------------------------

    def _counter_query(self, receipt_year: int):
        """The school's receipt counter for a year, locked until the payment commits."""
        return (select(ReceiptCounter)
                .where(ReceiptCounter.tenant_id == self.tenant_id, ReceiptCounter.year == receipt_year)
                .with_for_update())

    def next_receipt(self, receipt_year: int) -> Tuple[int, str]:
        dialect = self.db.bind.dialect.name if self.db.bind is not None else ""
        values = {"id": __import__("uuid").uuid4(), "tenant_id": self.tenant_id, "year": receipt_year, "last_number": 0,
                  "created_at": _now(), "updated_at": _now()}
        if dialect in ("postgresql", "sqlite"):
            insert = pg_insert if dialect == "postgresql" else sqlite_insert
            self.db.execute(insert(ReceiptCounter).values(**values)
                            .on_conflict_do_nothing(index_elements=["tenant_id", "year"]))
        counter = self.db.execute(self._counter_query(receipt_year)).scalar_one_or_none()
        if counter is None:  # other databases
            counter = ReceiptCounter(**values)
            self.db.add(counter)
        counter.last_number = (counter.last_number or 0) + 1
        counter.updated_at = _now()
        self.db.flush()
        return counter.last_number, f"{receipt_year}-{counter.last_number:05d}"

    def record_payment(self, data: Dict[str, Any]) -> Dict[str, Any]:
        student = self.student(data.get("student_id"))
        year = self.year(data.get("academic_year_id"))
        amount = _amount(data.get("amount"), "amount", allow_zero=False)
        if amount is None:
            raise _422("amount is required")
        currency = (data.get("currency") or "").upper()
        if currency not in CURRENCIES:
            raise _422("currency must be USD or LRD")
        method = data.get("method")
        if method not in PAYMENT_METHODS:
            raise _422("method must be cash, bank or mobile_money")

        account = self._account(student.id, year.id, lock=True)  # SELECT ... FOR UPDATE: one cashier at a time
        if account is None:
            raise _409("No fees have been issued to this student for this school year")
        if account.currency and currency != account.currency:
            raise _409(f"This student pays in {account.currency} this school year")
        led = self._ledger(year.id, [account.id])
        calc = led["calcs"][account.id]
        if not account.currency and currency not in calc.currencies():
            raise _409(f"This student's bill has no {currency} amount")
        outstanding = []
        for inv in led["invoices"].get(account.id, []):
            if inv.status != "issued":
                continue
            ic = led["inv_calcs"][inv.id]
            due = q((ic.owed(currency) or ZERO) - ic.paid_in(currency, currency))
            outstanding.append((inv.id, due))
        balance = q(sum((d for _, d in outstanding), ZERO))
        if amount > balance:
            raise _409(f"Balance is {currency} {money(balance)}")

        receipt_year = year.start_date.year
        seq, number = self.next_receipt(receipt_year)
        now = _now()
        payment = Payment(tenant_id=self.tenant_id, account_id=account.id, receipt_year=receipt_year, receipt_seq=seq,
                          receipt_number=number, amount=amount, currency=currency, method=method,
                          reference=(data.get("reference") or None), note=(data.get("note") or None),
                          received_by=getattr(self.user, "id", None), received_at=now,
                          balance_after=q(balance - amount))
        self.db.add(payment)
        self.db.flush()
        for invoice_id, part in L.allocate(amount, outstanding):
            self.db.add(PaymentAllocation(tenant_id=self.tenant_id, payment_id=payment.id, invoice_id=invoice_id, amount=part))
        if not account.currency:
            account.currency = currency
            account.currency_locked_at = now
        self.db.flush()
        alerts.payment_received(self.db, self.tenant_id, student.id, payment_id=payment.id, amount=money(amount),
                                currency=currency, receipt_number=number)
        return self.receipt(payment.id)

    def _payment_row(self, p: Payment, people=None, allocations: bool = False, sems=None) -> Dict[str, Any]:
        people = people if people is not None else self._users([p.received_by, p.voided_by])
        row = {
            "id": p.id, "receipt_number": p.receipt_number, "amount": money(p.amount), "currency": p.currency,
            "method": p.method, "reference": p.reference, "note": p.note, "received_at": _aware(p.received_at),
            "received_by": p.received_by, "received_by_name": _name(people.get(p.received_by)),
            "voided": p.voided_at is not None, "voided_at": _aware(p.voided_at), "voided_by": p.voided_by,
            "voided_by_name": _name(people.get(p.voided_by)), "void_reason": p.void_reason,
            "amount_in_words": amount_in_words(p.amount, p.currency), "can_void": self.may_void(p),
        }
        if allocations:
            if sems is None:
                sems = {s.id: s for s in self.db.query(Semester).filter(Semester.tenant_id == self.tenant_id)}
            allocs = (self.db.query(PaymentAllocation, Invoice.semester_id)
                      .join(Invoice, and_(Invoice.id == PaymentAllocation.invoice_id, Invoice.tenant_id == PaymentAllocation.tenant_id))
                      .filter(PaymentAllocation.tenant_id == self.tenant_id, PaymentAllocation.payment_id == p.id).all())
            row["allocations"] = [{"invoice_id": a.invoice_id, "semester_id": sem_id,
                                   "semester_name": sems[sem_id].name if sem_id in sems else None, "amount": money(a.amount)}
                                  for a, sem_id in allocs]
            row["unallocated"] = money(q(p.amount) - sum((q(a.amount) for a, _ in allocs), ZERO))
        return row

    def may_void(self, p: Payment) -> bool:
        """Whether the current user may void the payment: approve_financial_transactions, or
        record_payments for their own payment on the same school day."""
        if p.voided_at is not None or self.user is None:
            return False
        if self.can("approve_financial_transactions"):
            return True
        return (self.can("record_payments") and p.received_by is not None
                and str(p.received_by) == str(getattr(self.user, "id", None))
                and self.local_date(p.received_at) == self.today())

    def receipt(self, payment_id) -> Dict[str, Any]:
        from src.services.academics import report_identity_service as ri
        p = self._get(Payment, payment_id, "Payment")
        account = self.db.query(StudentFeeAccount).filter(StudentFeeAccount.id == p.account_id).one()
        student = self.db.query(Student).filter(Student.id == account.student_id).one()
        year = self.db.query(AcademicYear).filter(AcademicYear.id == account.academic_year_id).one()
        info = self._enrollment_info(year.id, [student.id]).get(student.id, {})
        led = self._ledger(year.id, [account.id])
        totals = led["calcs"][account.id].totals(self.today())
        row = self._payment_row(p, allocations=True, sems=led["semesters"])
        row.update({
            "receipt_year": p.receipt_year,
            "student_id": student.id, "student_name": f"{student.first_name} {student.last_name}",
            "admission_number": student.admission_number, "class_name": info.get("class_name"),
            "academic_year_name": year.name,
            "student": {"id": student.id, "name": f"{student.first_name} {student.last_name}",
                        "admission_number": student.admission_number, "class_name": info.get("class_name")},
            "academic_year": {"id": year.id, "name": year.name},
            # As it stood right after this payment (fixed for reprints); balance_now is today's
            "balance_after": ({p.currency: money(p.balance_after)} if p.balance_after is not None else None),
            "balance_now": money_map(totals["balance"]),
            "school": ri.school_block(self.db, self.tenant_id),
        })
        return row

    def void_payment(self, payment_id, reason: str) -> Dict[str, Any]:
        p = self._get(Payment, payment_id, "Payment")
        if p.voided_at is not None:
            raise _409("This payment is already void")
        if not (reason or "").strip():
            raise _422("Give a reason")
        if not self.may_void(p):
            raise _403("Only the person who recorded this payment can void it, and only on the same day. "
                       "Ask the principal to void it.")
        p.voided_at = _now()
        p.voided_by = getattr(self.user, "id", None)
        p.void_reason = reason.strip()
        self.db.flush()
        return self.receipt(p.id)

    def list_payments(self, *, date_from: Optional[date] = None, date_to: Optional[date] = None, method: Optional[str] = None,
                      received_by=None, q_text: Optional[str] = None, status_filter: str = "all", academic_year_id=None,
                      student_id=None, page: int = 1, page_size: int = 25) -> Dict[str, Any]:
        if method and method not in PAYMENT_METHODS:
            raise _422("method must be cash, bank or mobile_money")
        if status_filter not in ("all", "valid", "void"):
            raise _422("status must be all, valid or void")
        page = max(int(page), 1)
        page_size = min(max(int(page_size), 1), MAX_PAGE_SIZE)
        query = (self.db.query(Payment, Student, StudentFeeAccount.academic_year_id)
                 .join(StudentFeeAccount, and_(StudentFeeAccount.id == Payment.account_id,
                                               StudentFeeAccount.tenant_id == Payment.tenant_id))
                 .join(Student, and_(Student.id == StudentFeeAccount.student_id, Student.tenant_id == StudentFeeAccount.tenant_id))
                 .filter(Payment.tenant_id == self.tenant_id))
        lo, hi = self._day_bounds(date_from, date_to)
        if lo:
            query = query.filter(Payment.received_at >= lo)
        if hi:
            query = query.filter(Payment.received_at < hi)
        if method:
            query = query.filter(Payment.method == method)
        if received_by:
            query = query.filter(Payment.received_by == _uuid(received_by))
        if academic_year_id:
            query = query.filter(StudentFeeAccount.academic_year_id == _uuid(academic_year_id))
        if student_id:
            query = query.filter(StudentFeeAccount.student_id == _uuid(student_id))
        if status_filter == "valid":
            query = query.filter(Payment.voided_at.is_(None))
        elif status_filter == "void":
            query = query.filter(Payment.voided_at.isnot(None))
        if q_text and q_text.strip():
            term = f"%{q_text.strip().lower()}%"
            query = query.filter(or_(
                func.lower(func.concat(Student.first_name, " ", Student.last_name)).like(term),
                func.lower(Student.admission_number).like(term),
                func.lower(Payment.receipt_number).like(term),
                func.lower(func.coalesce(Payment.reference, "")).like(term),
            ))
        totals = L.sum_by_currency((c, a) for c, a in query.filter(Payment.voided_at.is_(None))
                                   .with_entities(Payment.currency, Payment.amount).all())
        total = query.with_entities(func.count(Payment.id)).scalar() or 0
        rows = query.order_by(Payment.received_at.desc(), Payment.receipt_number.desc()) \
            .offset((page - 1) * page_size).limit(page_size).all()
        people = self._users([p.received_by for p, _, _ in rows] + [p.voided_by for p, _, _ in rows])
        by_year = defaultdict(list)
        for p, student, year_id in rows:
            by_year[year_id].append((p.account_id, student.id))
        balances, classes, year_names = {}, {}, {}
        today = self.today()
        for year_id, pairs in by_year.items():
            led = self._ledger(year_id, {a for a, _ in pairs})
            for account_id, calc in led["calcs"].items():
                balances[account_id] = money_map(calc.totals(today)["balance"])
            for sid, e in self._enrollment_info(year_id, {s for _, s in pairs}).items():
                classes[(year_id, sid)] = e.get("class_name")
        if by_year:
            year_names = {y.id: y.name for y in self.db.query(AcademicYear).filter(
                AcademicYear.tenant_id == self.tenant_id, AcademicYear.id.in_(list(by_year)))}
        items = []
        for p, student, year_id in rows:
            row = self._payment_row(p, people=people)
            row.update({"student_id": student.id, "student_name": f"{student.first_name} {student.last_name}",
                        "admission_number": student.admission_number, "class_name": classes.get((year_id, student.id)),
                        "academic_year_id": year_id, "academic_year_name": year_names.get(year_id),
                        "balance_now": balances.get(p.account_id, {})})
            items.append(row)
        return {"items": items, "total": total, "page": page, "page_size": page_size,
                "pages": (total + page_size - 1) // page_size, "totals": money_map(totals)}

    def receivers(self, date_from: Optional[date] = None, date_to: Optional[date] = None) -> List[Dict[str, Any]]:
        """Who recorded payments (in the period): the Payments screen's receiver filter."""
        query = self.db.query(Payment.received_by).filter(Payment.tenant_id == self.tenant_id, Payment.received_by.isnot(None))
        lo, hi = self._day_bounds(date_from, date_to)
        if lo:
            query = query.filter(Payment.received_at >= lo)
        if hi:
            query = query.filter(Payment.received_at < hi)
        people = self._users(r[0] for r in query.distinct())
        return sorted(({"user_id": u.id, "name": _name(u)} for u in people.values()), key=lambda r: (r["name"] or "").lower())

    # --- reports --------------------------------------------------------------------------------

    def collections(self, date_from: Optional[date] = None, date_to: Optional[date] = None) -> Dict[str, Any]:
        today = self.today()
        date_to = date_to or today
        date_from = date_from or date_to
        if date_from > date_to:
            raise _422("from must be on or before to")
        lo, hi = self._day_bounds(date_from, date_to)
        payments = self.db.query(Payment).filter(Payment.tenant_id == self.tenant_id, Payment.received_at >= lo,
                                                 Payment.received_at < hi).all()
        valid = [p for p in payments if p.voided_at is None]
        void = [p for p in payments if p.voided_at is not None]
        people = self._users(p.received_by for p in valid)

        def grouped(key_fn):
            groups = defaultdict(lambda: {"count": 0, "totals": {}})
            for p in valid:
                g = groups[key_fn(p)]
                g["count"] += 1
                L.add_into(g["totals"], {p.currency: q(p.amount)})
            return groups
        by_day = grouped(lambda p: self.local_date(p.received_at))
        by_method = grouped(lambda p: p.method)
        by_receiver = grouped(lambda p: p.received_by)
        return {
            "from": date_from, "to": date_to,
            "totals": money_map(L.sum_by_currency((p.currency, p.amount) for p in valid)),
            "count": len(valid),
            "by_day": [{"date": d, "count": g["count"], "totals": money_map(g["totals"])} for d, g in sorted(by_day.items())],
            "by_method": [{"method": m, "count": g["count"], "totals": money_map(g["totals"])}
                          for m, g in sorted(by_method.items())],
            "by_receiver": [{"received_by": u, "received_by_name": _name(people.get(u)) if u else None, "count": g["count"],
                             "totals": money_map(g["totals"])}
                            for u, g in sorted(by_receiver.items(), key=lambda x: (_name(people.get(x[0])) or "").lower())],
            "voided": {"count": len(void), "totals": money_map(L.sum_by_currency((p.currency, p.amount) for p in void))},
        }

    def arrears(self, academic_year_id=None, class_id=None) -> Dict[str, Any]:
        year = self.year(academic_year_id)
        led = self._ledger(year.id)
        info = self._enrollment_info(year.id, [a.student_id for a in led["accounts"].values()])
        today = self.today()
        classes: Dict[Any, Dict[str, Any]] = {}
        grand = {"students": 0, "students_overdue": 0, "overdue": {}, "balance": {}}
        for account in led["accounts"].values():
            e = info.get(account.student_id, {})
            if class_id and e.get("class_id") != _uuid(class_id):
                continue
            calc = led["calcs"][account.id]
            c = calc.primary_currency()
            if c is None:
                continue
            totals = calc.totals(today)
            row = classes.setdefault(e.get("class_id"), {
                "class_id": e.get("class_id"), "class_name": e.get("class_name"), "_seq": e.get("grade_sequence"),
                "students": 0, "students_overdue": 0, "overdue": {}, "balance": {}})
            for target in (row, grand):
                target["students"] += 1
                if totals["overdue"][c] > 0:
                    target["students_overdue"] += 1
                L.add_into(target["overdue"], {c: totals["overdue"][c]})
                L.add_into(target["balance"], {c: totals["balance"][c]})
        rows = sorted(classes.values(), key=lambda r: (r["class_id"] is None, r["_seq"] or 0, (r["class_name"] or "").lower()))
        return {
            "academic_year": {"id": year.id, "name": year.name}, "today": today,
            "classes": [{"class_id": r["class_id"], "class_name": r["class_name"], "students": r["students"],
                         "students_overdue": r["students_overdue"], "overdue": money_map(r["overdue"]),
                         "balance": money_map(r["balance"])} for r in rows],
            "totals": {"students": grand["students"], "students_overdue": grand["students_overdue"],
                       "overdue": money_map(grand["overdue"]), "balance": money_map(grand["balance"])},
        }

    # --- family (parents and students) ----------------------------------------------------------

    def _family_student_ids(self) -> List[UUID]:
        from src.db.models.people.parent import parent_student
        from src.services.academics.attendance_access import role_names
        names = role_names(self.user)
        if "student" in names:
            return [self.user.id]
        if "parent" in names:
            return [r[0] for r in self.db.query(parent_student.c.student_id)
                    .join(Student, and_(Student.id == parent_student.c.student_id, Student.tenant_id == self.tenant_id))
                    .filter(parent_student.c.parent_id == self.user.id).all()]
        raise _403("Only parents and students can open the family fees page")

    def _require_family_student(self, student_id) -> Student:
        student = self.student(student_id)  # 404 outside this school
        if str(student.id) not in {str(i) for i in self._family_student_ids()}:
            raise _403("You can only see your own children's fees")
        return student

    def family_students(self, academic_year_id=None) -> List[Dict[str, Any]]:
        ids = self._family_student_ids()
        year = self.db.query(AcademicYear).filter(
            AcademicYear.tenant_id == self.tenant_id,
            AcademicYear.id == _uuid(academic_year_id) if academic_year_id else AcademicYear.is_current == True  # noqa: E712
        ).first()
        if academic_year_id and year is None:
            raise _404("School year")
        students = self.db.query(Student).filter(Student.tenant_id == self.tenant_id, Student.id.in_(ids or [None])).all()
        info = self._enrollment_info(year.id, ids) if year else {}
        from src.services.tenant.features import feature_enabled
        finance_on = feature_enabled(self.db, self.tenant_id, "enable_finance")
        accounts, calcs = {}, {}
        if year and finance_on:
            led = self._ledger(year.id, [a.id for a in self.db.query(StudentFeeAccount).filter(
                StudentFeeAccount.tenant_id == self.tenant_id, StudentFeeAccount.academic_year_id == year.id,
                StudentFeeAccount.student_id.in_(ids or [None]))])
            accounts = {a.student_id: a for a in led["accounts"].values()}
            calcs = led["calcs"]
        out = []
        for s in sorted(students, key=lambda s: ((s.first_name or "").lower(), (s.last_name or "").lower())):
            account = accounts.get(s.id)
            item = {"student_id": s.id, "name": f"{s.first_name} {s.last_name}",
                    "admission_number": s.admission_number, "class_name": info.get(s.id, {}).get("class_name"),
                    "academic_year_id": year.id if year else None, "currency": None, "currencies": [],
                    "balance": {}, "overdue": {}, "next_due": None, "report_cards_held": False,
                    "finance_enabled": finance_on}
            if account is not None:
                st = self.statement(s.id, year.id)
                nxt = next((i for i in st["installments"] if i["status"] == "due"), None)
                item.update({"currency": account.currency, "currencies": st["currencies"], "balance": st["balance"],
                             "overdue": st["overdue"], "report_cards_held": st["report_cards_held"],
                             "next_due": {"due_date": nxt["due_date"], "amount": nxt["outstanding"]} if nxt else None})
            out.append(item)
        return out

    def family_statement(self, student_id, academic_year_id=None) -> Dict[str, Any]:
        student = self._require_family_student(student_id)
        out = self.statement(student.id, academic_year_id)
        out.pop("report_card_hold", None)  # staff detail (setting, override); families get report_cards_held
        if out["account"]:
            out["account"] = {"currency": out["account"]["currency"],
                              "currency_locked_at": out["account"]["currency_locked_at"]}
        out["payments"] = [{k: p[k] for k in FAMILY_PAYMENT_FIELDS} for p in out["payments"]]
        return out

    def family_receipt(self, payment_id) -> Dict[str, Any]:
        p = self._get(Payment, payment_id, "Payment")
        account = self.db.query(StudentFeeAccount).filter(StudentFeeAccount.id == p.account_id).one()
        if str(account.student_id) not in {str(i) for i in self._family_student_ids()}:
            raise _404("Payment")
        r = self.receipt(p.id)
        for key in ("voided_by", "received_by", "can_void"):
            r.pop(key, None)
        return r


def report_card_held(db: Session, tenant_id, student_id, academic_year_id) -> bool:
    """Whether a student's (or parent's) report card for the year is held for overdue fees
    (design §1): the school's setting is on, the student owes an overdue amount for that year,
    and the school hasn't allowed this student."""
    from src.services.tenant.features import feature_enabled
    tenant_id = _uuid(tenant_id)
    if not feature_enabled(db, tenant_id, "enable_finance"):
        return False
    setting = db.query(FinanceSettings.hold_report_cards_on_arrears).filter(FinanceSettings.tenant_id == tenant_id).first()
    if not setting or not setting[0]:
        return False
    account = db.query(StudentFeeAccount).filter(
        StudentFeeAccount.tenant_id == tenant_id, StudentFeeAccount.student_id == _uuid(student_id),
        StudentFeeAccount.academic_year_id == _uuid(academic_year_id)).first()
    if account is None or account.report_card_hold_override:
        return False
    service = FeeService(db, tenant_id, None)
    led = service._ledger(account.academic_year_id, [account.id])
    overdue = led["calcs"][account.id].totals(service.today())["overdue"]
    return any(v > 0 for v in overdue.values())

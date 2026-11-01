"""School fees API (docs/remodel/phase5-design.md §4-§5), mounted at /api/v1/finance.

Permissions per endpoint (§4): reads need view_financial_data; setup and invoices create_invoices;
payments record_payments; adjustments, invoice voids, currency resets and report-card hold
overrides approve_financial_transactions; settings changes manage_financial_data; reports
generate_financial_reports or view_financial_data. Voiding a payment needs record_payments (own
payment, same school day) or approve_financial_transactions: the service checks which.
Money is sent and returned as strings with two decimals ("120.00"); numbers are accepted too.
"""
from datetime import date
from decimal import Decimal
from typing import Any, List, Literal, Optional, Union
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.core.auth.dependencies import get_current_active_user, has_any_permission, has_permission
from src.core.middleware.tenant import get_tenant_id_from_request
from src.db.session import get_db
from src.services.finance.fee_service import MAX_PAGE_SIZE, FeeService

router = APIRouter()

Amount = Optional[Union[Decimal, str]]
VIEW = has_permission("view_financial_data")
SETUP = has_permission("create_invoices")
APPROVE = has_permission("approve_financial_transactions")


def _service(db: Session = Depends(get_db), tenant_id=Depends(get_tenant_id_from_request),
             user=Depends(get_current_active_user)) -> FeeService:
    return FeeService(db=db, tenant_id=tenant_id, user=user)


class SettingsIn(BaseModel):
    hold_report_cards_on_arrears: bool


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: bool = True


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ScheduleIn(BaseModel):
    academic_year_id: UUID
    semester_id: UUID
    grade_id: Optional[UUID] = None
    category_id: UUID
    amount_usd: Amount = None
    amount_lrd: Amount = None


class ScheduleUpdate(BaseModel):
    academic_year_id: Optional[UUID] = None
    semester_id: Optional[UUID] = None
    grade_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    amount_usd: Amount = None
    amount_lrd: Amount = None


class InstallmentIn(BaseModel):
    due_date: date
    percent: Union[Decimal, str]


class IssueIn(BaseModel):
    academic_year_id: UUID
    semester_id: UUID
    grade_id: Optional[UUID] = None
    class_id: Optional[UUID] = None


class ReasonIn(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class AdjustmentIn(BaseModel):
    kind: Literal["discount", "scholarship", "waiver"]
    percent: Amount = None
    amount_usd: Amount = None
    amount_lrd: Amount = None
    reason: str = Field(min_length=1, max_length=500)


class PaymentIn(BaseModel):
    student_id: UUID
    academic_year_id: UUID
    amount: Union[Decimal, str]
    currency: Literal["USD", "LRD"]
    method: Literal["cash", "bank", "mobile_money"]
    reference: Optional[str] = Field(None, max_length=100)
    note: Optional[str] = Field(None, max_length=1000)


class HoldOverrideIn(BaseModel):
    override: bool


# --- settings ------------------------------------------------------------------------------------

@router.get("/settings")
def get_settings(_=Depends(VIEW), service: FeeService = Depends(_service)) -> Any:
    return service.settings()


@router.put("/settings")
def put_settings(body: SettingsIn, _=Depends(has_permission("manage_financial_data")),
                 service: FeeService = Depends(_service)) -> Any:
    return service.update_settings(body.hold_report_cards_on_arrears)


# --- categories ----------------------------------------------------------------------------------

@router.get("/categories")
def list_categories(_=Depends(VIEW), service: FeeService = Depends(_service)) -> Any:
    return service.list_categories()


@router.post("/categories")
def create_category(body: CategoryIn, _=Depends(SETUP), service: FeeService = Depends(_service)) -> Any:
    return service.create_category(body.model_dump())


@router.put("/categories/{category_id}")
def update_category(category_id: UUID, body: CategoryUpdate, _=Depends(SETUP),
                    service: FeeService = Depends(_service)) -> Any:
    return service.update_category(category_id, body.model_dump(exclude_unset=True))


@router.delete("/categories/{category_id}")
def delete_category(category_id: UUID, _=Depends(SETUP), service: FeeService = Depends(_service)) -> Any:
    return service.delete_category(category_id)


# --- schedules -----------------------------------------------------------------------------------

@router.get("/schedules")
def list_schedules(academic_year_id: Optional[UUID] = None, semester_id: Optional[UUID] = None,
                   grade_id: Optional[UUID] = None, _=Depends(VIEW), service: FeeService = Depends(_service)) -> Any:
    return service.list_schedules(academic_year_id, semester_id, grade_id)


@router.post("/schedules")
def create_schedule(body: ScheduleIn, _=Depends(SETUP), service: FeeService = Depends(_service)) -> Any:
    return service.create_schedule(body.model_dump())


@router.put("/schedules/{schedule_id}")
def update_schedule(schedule_id: UUID, body: ScheduleUpdate, _=Depends(SETUP),
                    service: FeeService = Depends(_service)) -> Any:
    return service.update_schedule(schedule_id, body.model_dump(exclude_unset=True))


@router.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: UUID, _=Depends(SETUP), service: FeeService = Depends(_service)) -> Any:
    return service.delete_schedule(schedule_id)


# --- installment plans ---------------------------------------------------------------------------

@router.get("/installment-plans")
def list_plans(academic_year_id: Optional[UUID] = None, semester_id: Optional[UUID] = None,
               _=Depends(VIEW), service: FeeService = Depends(_service)) -> Any:
    return service.list_plans(academic_year_id, semester_id)


@router.put("/installment-plans")
def replace_plan(body: List[InstallmentIn], semester_id: UUID, academic_year_id: Optional[UUID] = None,
                 _=Depends(SETUP), service: FeeService = Depends(_service)) -> Any:
    """Replace a semester's plan with the body's [{due_date, percent}] (percents add up to 100); an
    empty list removes it (the bill is then due at the semester's end)."""
    if len(body) > 24:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="At most 24 installments")
    return service.replace_plan(semester_id, [i.model_dump() for i in body], academic_year_id)


# --- invoices and adjustments --------------------------------------------------------------------

@router.post("/invoices/issue")
def issue_invoices(body: IssueIn, _=Depends(SETUP), service: FeeService = Depends(_service)) -> Any:
    return service.issue_invoices(body.academic_year_id, body.semester_id, body.grade_id, body.class_id)


@router.post("/invoices/{invoice_id}/void")
def void_invoice(invoice_id: UUID, body: ReasonIn, _=Depends(APPROVE), service: FeeService = Depends(_service)) -> Any:
    return service.void_invoice(invoice_id, body.reason)


@router.post("/invoices/{invoice_id}/adjustments")
def add_adjustment(invoice_id: UUID, body: AdjustmentIn, _=Depends(APPROVE),
                   service: FeeService = Depends(_service)) -> Any:
    return service.add_adjustment(invoice_id, body.model_dump())


@router.delete("/adjustments/{adjustment_id}")
def delete_adjustment(adjustment_id: UUID, _=Depends(APPROVE), service: FeeService = Depends(_service)) -> Any:
    return service.delete_adjustment(adjustment_id)


# --- accounts ------------------------------------------------------------------------------------

@router.get("/accounts")
def list_accounts(
    academic_year_id: Optional[UUID] = None,
    class_id: Optional[UUID] = None,
    status: str = Query("all", description="all, owing, overdue or paid"),
    q: Optional[str] = Query(None, max_length=100, description="Name, username or admission number"),
    sort: str = Query("name", description="name, admission_number, class, balance, overdue or last_payment"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=MAX_PAGE_SIZE),
    _=Depends(VIEW),
    service: FeeService = Depends(_service),
) -> Any:
    return service.list_accounts(academic_year_id=academic_year_id, class_id=class_id, status_filter=status,
                                 q_text=q, sort=sort, page=page, page_size=page_size)


@router.get("/accounts/{student_id}")
def statement(student_id: UUID, academic_year_id: Optional[UUID] = None, _=Depends(VIEW),
              service: FeeService = Depends(_service)) -> Any:
    return service.statement(student_id, academic_year_id)


@router.post("/accounts/{student_id}/reset-currency")
def reset_currency(student_id: UUID, academic_year_id: Optional[UUID] = None, _=Depends(APPROVE),
                   service: FeeService = Depends(_service)) -> Any:
    """Unfix the student's currency for the year (only when none of their payments is valid)."""
    return service.reset_currency(student_id, academic_year_id)


@router.put("/accounts/{student_id}/report-card-hold")
def hold_override(student_id: UUID, body: HoldOverrideIn, academic_year_id: Optional[UUID] = None,
                  _=Depends(APPROVE), service: FeeService = Depends(_service)) -> Any:
    """override = true lets this student see report cards despite overdue fees."""
    return service.set_hold_override(student_id, academic_year_id, body.override)


# --- payments ------------------------------------------------------------------------------------

@router.post("/payments")
def record_payment(body: PaymentIn, _=Depends(has_permission("record_payments")),
                   service: FeeService = Depends(_service)) -> Any:
    return service.record_payment(body.model_dump())


@router.get("/payments")
def list_payments(
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = None,
    method: Optional[str] = None,
    received_by: Optional[UUID] = None,
    q: Optional[str] = Query(None, max_length=100),
    status: str = Query("all", description="all, valid or void"),
    academic_year_id: Optional[UUID] = None,
    student_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=MAX_PAGE_SIZE),
    _=Depends(VIEW),
    service: FeeService = Depends(_service),
) -> Any:
    return service.list_payments(date_from=from_, date_to=to, method=method, received_by=received_by, q_text=q,
                                 status_filter=status, academic_year_id=academic_year_id, student_id=student_id,
                                 page=page, page_size=page_size)


@router.get("/payments/receivers")
def receivers(from_: Optional[date] = Query(None, alias="from"), to: Optional[date] = None,
              _=Depends(VIEW), service: FeeService = Depends(_service)) -> Any:
    return service.receivers(from_, to)


@router.get("/payments/{payment_id}")
def receipt(payment_id: UUID, _=Depends(VIEW), service: FeeService = Depends(_service)) -> Any:
    return service.receipt(payment_id)


@router.post("/payments/{payment_id}/void")
def void_payment(payment_id: UUID, body: ReasonIn,
                 _=Depends(has_any_permission(["record_payments", "approve_financial_transactions"])),
                 service: FeeService = Depends(_service)) -> Any:
    return service.void_payment(payment_id, body.reason)


# --- reports -------------------------------------------------------------------------------------

REPORTS = has_any_permission(["generate_financial_reports", "view_financial_data"])


@router.get("/reports/collections")
def collections(from_: Optional[date] = Query(None, alias="from"), to: Optional[date] = None,
                _=Depends(REPORTS), service: FeeService = Depends(_service)) -> Any:
    return service.collections(from_, to)


@router.get("/reports/arrears")
def arrears(academic_year_id: Optional[UUID] = None, class_id: Optional[UUID] = None,
            _=Depends(REPORTS), service: FeeService = Depends(_service)) -> Any:
    return service.arrears(academic_year_id, class_id)

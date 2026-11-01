"""Platform billing for the operator (docs/remodel/phase7-design.md §5), mounted at
/api/v1/super-admin/billing. Super-admin only, on a platform session (every school), except the
payment provider webhook: a public route (PUBLIC_ROUTES) that answers 404 until a provider is
configured (services/billing/providers.py).

Money is sent and returned as strings with two decimals ("120.00"); numbers are accepted too.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal, Optional, Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.core.security.auth import get_current_active_user
from src.core.security.permissions import require_super_admin
from src.db.models.billing import PlatformPayment
from src.db.session import get_super_admin_db
from src.services.billing.platform_billing import MAX_PAGE_SIZE, BillingService
from src.services.billing.providers import get_provider

router = APIRouter()
operator = APIRouter(dependencies=[Depends(require_super_admin())])

Amount = Union[Decimal, str]


def _service(db: Session = Depends(get_super_admin_db), user=Depends(get_current_active_user)) -> BillingService:
    return BillingService(db, user)


class PriceIn(BaseModel):
    effective_from: date
    staff_per_month_usd: Amount
    staff_per_month_lrd: Amount
    family_per_month_usd: Amount
    family_per_month_lrd: Amount
    term_minimum_usd: Amount
    term_minimum_lrd: Amount


class IssueIn(BaseModel):
    semester_id: UUID


class ReasonIn(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class PaymentIn(BaseModel):
    amount: Amount
    currency: Literal["USD", "LRD"]
    method: Literal["bank", "mobile_money", "cash"]
    reference: Optional[str] = Field(None, max_length=100)
    received_at: Optional[datetime] = None


class SubscriptionIn(BaseModel):
    grace_until: Optional[date] = None
    dormant: Optional[bool] = None


@operator.get("/prices")
def list_prices(service: BillingService = Depends(_service)) -> Any:
    return service.list_prices()


@operator.post("/prices")
def add_price(body: PriceIn, service: BillingService = Depends(_service)) -> Any:
    return service.add_price(body.model_dump())


@operator.get("/schools")
def list_schools(status_: Optional[str] = Query(None, alias="status"), q: Optional[str] = Query(None, max_length=100),
                 page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=MAX_PAGE_SIZE),
                 service: BillingService = Depends(_service)) -> Any:
    return service.list_schools(status_filter=status_, q_text=q, page=page, page_size=page_size)


@operator.get("/schools/{tenant_id}")
def school_detail(tenant_id: UUID, service: BillingService = Depends(_service)) -> Any:
    return service.school_detail(tenant_id)


@operator.post("/schools/{tenant_id}/invoices")
def issue_invoice(tenant_id: UUID, body: IssueIn, service: BillingService = Depends(_service)) -> Any:
    """Issue the school's invoice for a semester now (the daily job also does it). Idempotent:
    the live invoice is returned with created false."""
    return service.issue_out(tenant_id, body.semester_id)


@operator.put("/schools/{tenant_id}/subscription")
def update_subscription(tenant_id: UUID, body: SubscriptionIn, service: BillingService = Depends(_service)) -> Any:
    return service.update_subscription(tenant_id, body.model_dump(exclude_unset=True))


@operator.get("/invoices")
def list_invoices(status_: Optional[str] = Query(None, alias="status", description="all, issued, void, owing or paid"),
                  from_: Optional[date] = Query(None, alias="from"), to: Optional[date] = None,
                  page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=MAX_PAGE_SIZE),
                  service: BillingService = Depends(_service)) -> Any:
    return service.list_invoices(status_filter=status_, date_from=from_, date_to=to, page=page, page_size=page_size)


@operator.get("/invoices/{invoice_id}")
def invoice_detail(invoice_id: UUID, service: BillingService = Depends(_service)) -> Any:
    return service.invoice_detail(invoice_id)


@operator.post("/invoices/{invoice_id}/void")
def void_invoice(invoice_id: UUID, body: ReasonIn, service: BillingService = Depends(_service)) -> Any:
    return service.void_invoice(invoice_id, body.reason)


@operator.post("/invoices/{invoice_id}/payments")
def record_payment(invoice_id: UUID, body: PaymentIn, service: BillingService = Depends(_service)) -> Any:
    """Record a bank, mobile money or cash payment; returns the receipt."""
    return service.record_payment(invoice_id, body.model_dump())


@operator.get("/payments/{payment_id}/receipt")
def receipt(payment_id: UUID, service: BillingService = Depends(_service)) -> Any:
    return service.receipt(payment_id)


@operator.post("/payments/{payment_id}/void")
def void_payment(payment_id: UUID, body: ReasonIn, service: BillingService = Depends(_service)) -> Any:
    return service.void_payment(payment_id, body.reason)


@operator.get("/summary")
def summary(service: BillingService = Depends(_service)) -> Any:
    return service.summary()


@router.post("/payments/webhook/{provider}")
async def provider_webhook(provider: str, request: Request, db: Session = Depends(get_super_admin_db)) -> Any:
    """A payment provider's notification (public). 404 while no provider is configured."""
    handler = get_provider(provider)
    if handler is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown payment provider")
    body = await request.body()
    if not handler.verify(request.headers, body):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")
    paid = handler.parse(body)
    if paid is None:
        return {"recorded": False}
    existing = db.query(PlatformPayment.id).filter(PlatformPayment.provider == provider,
                                                   PlatformPayment.provider_ref == paid.provider_ref).first()
    if existing:
        return {"recorded": False, "payment_id": existing[0]}
    receipt_ = BillingService(db).record_payment(
        paid.invoice_id, {"amount": paid.amount, "currency": paid.currency, "method": "online",
                          "received_at": paid.received_at}, provider=provider, provider_ref=paid.provider_ref)
    return {"recorded": True, "payment_id": receipt_["id"], "receipt_number": receipt_["receipt_number"]}


router.include_router(operator)

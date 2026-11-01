"""A school's own platform billing (docs/remodel/phase7-design.md §5), mounted at /api/v1/billing.

GET /status is open to every signed-in user of the school (the app shell's banner; the amount due
is shown to admins only). Invoices, receipts and the export need the school's `admin` role.
Everything is filtered by the request's school: another school's invoice or payment is 404.
"""
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from src.core.middleware.tenant import get_tenant_id_from_request
from src.core.security.auth import get_current_active_user
from src.core.security.permissions import has_role
from src.db.session import get_db
from src.services.billing.export import export_filename, school_export
from src.services.billing.platform_billing import BillingService, payment_details

router = APIRouter()
ADMIN = has_role("admin")


def _school(request: Request) -> None:
    if getattr(request.state, "tenant_id", None) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a school first")


def _service(db: Session = Depends(get_db), user=Depends(get_current_active_user)) -> BillingService:
    return BillingService(db, user)


@router.get("/status", dependencies=[Depends(_school)])
def billing_status(tenant_id=Depends(get_tenant_id_from_request), user=Depends(get_current_active_user),
                   service: BillingService = Depends(_service)) -> Any:
    return service.school_status(tenant_id, user)


@router.get("/invoices", dependencies=[Depends(_school)])
def invoices(_=Depends(ADMIN), tenant_id=Depends(get_tenant_id_from_request),
             service: BillingService = Depends(_service)) -> Any:
    return service.invoice_list(tenant_id)


@router.get("/invoices/{invoice_id}", dependencies=[Depends(_school)])
def invoice(invoice_id: UUID, _=Depends(ADMIN), tenant_id=Depends(get_tenant_id_from_request),
            service: BillingService = Depends(_service)) -> Any:
    return service.invoice_detail(invoice_id, tenant_id)


@router.get("/payments/{payment_id}/receipt", dependencies=[Depends(_school)])
def receipt(payment_id: UUID, _=Depends(ADMIN), tenant_id=Depends(get_tenant_id_from_request),
            service: BillingService = Depends(_service)) -> Any:
    return service.receipt(payment_id, tenant_id)


@router.get("/payment-details", dependencies=[Depends(_school)])
def how_to_pay(_=Depends(ADMIN), db: Session = Depends(get_db)) -> Any:
    """The platform's payment details for the "How to pay" panel; instructions is null while the
    operator hasn't written any (the page then says to contact the platform administrator)."""
    return payment_details(db)


@router.get("/export", dependencies=[Depends(_school)])
def export(_=Depends(ADMIN), tenant_id=Depends(get_tenant_id_from_request),
           service: BillingService = Depends(_service)) -> Response:
    """A zip of CSVs: students, guardians, enrollments, published results, fee payments."""
    school = service.school(tenant_id)
    return Response(content=school_export(service.db, tenant_id), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{export_filename(school.code)}"'})

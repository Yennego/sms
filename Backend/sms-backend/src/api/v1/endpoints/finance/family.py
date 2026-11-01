"""A family's own fees (phase5-design.md §5): a parent sees their linked children, a student
themself. Read-only. Students of another school are 404; a payment the caller may not see is 404."""
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.core.auth.dependencies import get_current_active_user
from src.core.middleware.tenant import get_tenant_id_from_request
from src.db.session import get_db
from src.services.finance.fee_service import FeeService
from src.services.tenant.features import require_feature

router = APIRouter()
FINANCE_ON = [Depends(require_feature("enable_finance"))]


def _service(db: Session = Depends(get_db), tenant_id=Depends(get_tenant_id_from_request),
             user=Depends(get_current_active_user)) -> FeeService:
    return FeeService(db=db, tenant_id=tenant_id, user=user)


@router.get("/students")
def family_students(service: FeeService = Depends(_service)) -> Any:
    """Children (parent) or self (student) with this school year's balance. Also served while the
    school's finance switch is off (finance_enabled false, no fee figures): the child switcher uses it."""
    return service.family_students()


@router.get("/accounts/{student_id}", dependencies=FINANCE_ON)
def family_statement(student_id: UUID, academic_year_id: Optional[UUID] = None,
                     service: FeeService = Depends(_service)) -> Any:
    return service.family_statement(student_id, academic_year_id)


@router.get("/payments/{payment_id}", dependencies=FINANCE_ON)
def family_receipt(payment_id: UUID, service: FeeService = Depends(_service)) -> Any:
    return service.family_receipt(payment_id)

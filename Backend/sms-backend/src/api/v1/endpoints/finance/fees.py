from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from src.db.session import get_db
from src.core.security.auth import get_current_active_user
from src.core.middleware.tenant import get_tenant_id_from_request
from src.db.models.auth.user import User
from src.services.tenant.finance_service import finance_service
from src.schemas.finance.fee_category import FeeCategory, FeeCategoryCreate, FeeCategoryUpdate
from src.schemas.finance.fee_structure import FeeStructure, FeeStructureCreate, FeeStructureUpdate
from src.schemas.finance.student_fee import StudentFee, StudentFeeCreate, StudentFeeUpdate, BulkStudentFeeCreate
from src.schemas.finance.fee_payment import FeePayment, FeePaymentCreate
from src.schemas.finance.fee_installment import FeeInstallment
from src.db.crud.finance import fee_category, fee_structure, student_fee, fee_payment, fee_installment
from src.utils.export_utils import generate_xlsx_response, generate_pdf_response

router = APIRouter()

@router.get("/summary")
def get_revenue_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Get revenue summary (expected, collected, pending)."""
    return finance_service.get_revenue_summary(db=db, tenant_id=tenant_id)

@router.get("/categories", response_model=List[FeeCategory])
def read_fee_categories(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Retrieve fee categories."""
    return fee_category.get_multi(db, tenant_id=tenant_id, skip=skip, limit=limit)

@router.post("/categories", response_model=FeeCategory)
def create_fee_category(
    *,
    db: Session = Depends(get_db),
    category_in: FeeCategoryCreate,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Create new fee category."""
    return fee_category.create(db=db, obj_in=category_in, tenant_id=tenant_id)

@router.put("/categories/{category_id}", response_model=FeeCategory)
def update_fee_category(
    *,
    db: Session = Depends(get_db),
    category_id: UUID,
    category_in: FeeCategoryUpdate,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Update a fee category."""
    db_obj = fee_category.get_by_id(db, tenant_id=tenant_id, id=category_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Fee category not found")
    return fee_category.update(db=db, tenant_id=tenant_id, db_obj=db_obj, obj_in=category_in)

@router.delete("/categories/{category_id}", response_model=FeeCategory)
def delete_fee_category(
    *,
    db: Session = Depends(get_db),
    category_id: UUID,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Delete a fee category."""
    db_obj = fee_category.delete(db, tenant_id=tenant_id, id=category_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Fee category not found")
    return db_obj

@router.get("/structures", response_model=List[FeeStructure])
def read_fee_structures(
    skip: int = 0,
    limit: int = 100,
    academic_year_id: UUID = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Retrieve fee structures."""
    return fee_structure.get_multi(db, tenant_id=tenant_id, skip=skip, limit=limit)

@router.post("/structures", response_model=FeeStructure)
def create_fee_structure(
    *,
    db: Session = Depends(get_db),
    structure_in: FeeStructureCreate,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Create new fee structure."""
    return fee_structure.create(db=db, obj_in=structure_in, tenant_id=tenant_id)

@router.put("/structures/{structure_id}", response_model=FeeStructure)
def update_fee_structure(
    *,
    db: Session = Depends(get_db),
    structure_id: UUID,
    structure_in: FeeStructureUpdate,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Update a fee structure."""
    db_obj = fee_structure.get_by_id(db, tenant_id=tenant_id, id=structure_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    return fee_structure.update(db=db, tenant_id=tenant_id, db_obj=db_obj, obj_in=structure_in)

@router.delete("/structures/{structure_id}", response_model=FeeStructure)
def delete_fee_structure(
    *,
    db: Session = Depends(get_db),
    structure_id: UUID,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Delete a fee structure."""
    db_obj = fee_structure.delete(db, tenant_id=tenant_id, id=structure_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    return db_obj

@router.get("/student-fees", response_model=List[StudentFee])
def read_student_fees(
    skip: int = 0,
    limit: int = 100,
    student_id: UUID = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Retrieve student fees."""
    return student_fee.get_multi(db, tenant_id=tenant_id, skip=skip, limit=limit)

@router.post("/student-fees", response_model=StudentFee)
def create_student_fee(
    *,
    db: Session = Depends(get_db),
    fee_in: StudentFeeCreate,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Create a new student fee assignment."""
    return student_fee.create(db=db, tenant_id=tenant_id, obj_in=fee_in)

@router.get("/student-fees/export/xlsx")
def export_fees_xlsx(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Export student fees to XLSX."""
    try:
        data = finance_service.get_fees_export_data(db=db, tenant_id=tenant_id)
        return generate_xlsx_response(data, filename=f"student_fees_{tenant_id}")
    except Exception as e:
        with open("export_error.log", "a") as f:
            f.write(f"XLSX Export Error: {str(e)}\n")
            import traceback
            f.write(traceback.format_exc() + "\n")
        raise

@router.get("/student-fees/export/pdf")
def export_fees_pdf(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Export student fees to PDF."""
    try:
        data = finance_service.get_fees_export_data(db=db, tenant_id=tenant_id)
        return generate_pdf_response(data, filename=f"student_fees_{tenant_id}", title="Student Fees Report")
    except Exception as e:
        with open("export_error.log", "a") as f:
            f.write(f"PDF Export Error: {str(e)}\n")
            import traceback
            f.write(traceback.format_exc() + "\n")
        raise

@router.post("/student-fees/bulk")
def create_bulk_student_fees(
    *,
    db: Session = Depends(get_db),
    bulk_in: BulkStudentFeeCreate,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Assign a fee structure to all students in a grade level."""
    return student_fee.create_bulk(db=db, tenant_id=tenant_id, obj_in=bulk_in)

@router.put("/student-fees/{fee_id}", response_model=StudentFee)
def update_student_fee(
    *,
    db: Session = Depends(get_db),
    fee_id: UUID,
    fee_in: StudentFeeUpdate,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Update a student fee."""
    db_obj = student_fee.get_by_id(db, tenant_id=tenant_id, id=fee_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Student fee not found")
    return student_fee.update(db=db, tenant_id=tenant_id, db_obj=db_obj, obj_in=fee_in)

@router.delete("/student-fees/{fee_id}", response_model=StudentFee)
def delete_student_fee(
    *,
    db: Session = Depends(get_db),
    fee_id: UUID,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Delete a student fee."""
    db_obj = student_fee.delete(db, tenant_id=tenant_id, id=fee_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Student fee not found")
    return db_obj

@router.get("/installments", response_model=List[FeeInstallment])
def read_fee_installments(
    skip: int = 0,
    limit: int = 100,
    student_id: UUID = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Retrieve fee installments."""
    filters = {}
    if student_id:
        filters["student_id"] = student_id
    return fee_installment.get_multi(db, tenant_id=tenant_id, skip=skip, limit=limit, filters=filters)

@router.post("/payments", response_model=FeePayment)
def record_fee_payment(
    *,
    db: Session = Depends(get_db),
    payment_in: FeePaymentCreate,
    current_user: User = Depends(get_current_active_user),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
) -> Any:
    """Record a fee payment."""
    return finance_service.record_payment(db=db, tenant_id=tenant_id, payment_in=payment_in)

from typing import Any, List, Optional, Dict, Literal
from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session

from src.services.academics.enrollment import EnrollmentService
from src.services.academics.promotion_service import PromotionService
from src.db.session import get_db
from src.schemas.academics.enrollment import Enrollment, EnrollmentCreate, EnrollmentUpdate
from src.core.middleware.tenant import get_tenant_from_request
from src.core.auth.dependencies import has_permission, get_current_user
from src.schemas.auth import User

router = APIRouter()

@router.post("/enrollments", response_model=Enrollment)
@has_permission("manage_enrollment")
def create_enrollment(
    *,
    enrollment_service: EnrollmentService = Depends(),
    enrollment_in: EnrollmentCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Create a new enrollment."""
    return enrollment_service.create(obj_in=enrollment_in)

@router.get("/enrollments", response_model=List[Enrollment])
@has_permission("view_enrollment")
def get_enrollments(
    *,
    enrollment_service: EnrollmentService = Depends(),
    skip: int = 0,
    limit: int = 100,
    academic_year: Optional[str] = None,
    semester: Optional[int] = Query(None, ge=1, le=2),
    grade: Optional[str] = None,
    section: Optional[str] = None,
    status: Optional[str] = None
) -> Any:
    """Get enrollments with filtering including semester."""
    filters = {}
    if academic_year:
        filters["academic_year"] = academic_year
    if semester:
        filters["semester"] = semester
    if grade:
        filters["grade"] = grade
    if section:
        filters["section"] = section
    if status:
        filters["status"] = status
    
    return enrollment_service.get_multi(skip=skip, limit=limit, **filters)

@router.post("/enrollments/bulk-promote")
@has_permission("promote_students")
def bulk_promote_students(
    *,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_from_request),
    student_ids: List[UUID] = Body(...),
    promotion_type: Literal["semester", "grade", "graduation"] = Body(...),
    target_academic_year: Optional[str] = Body(None),
    target_semester: Optional[int] = Body(None, ge=1, le=2),
    promotion_rules: Optional[Dict[str, str]] = Body(None),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Bulk promote multiple students (semester or grade promotion)."""
    promotion_service = PromotionService(db=db, tenant_id=tenant_id)
    return promotion_service.bulk_promote_students(
        student_ids=student_ids,
        promotion_type=promotion_type,
        target_academic_year=target_academic_year,
        target_semester=target_semester,
        promotion_rules=promotion_rules
    )

@router.post("/enrollments/promote-semester")
@has_permission("promote_students")
def promote_semester_for_grade(
    *,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_from_request),
    grade: str = Body(...),
    section: Optional[str] = Body(None),
    target_semester: int = Body(2, ge=1, le=2),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Promote all students in a grade/section to next semester."""
    promotion_service = PromotionService(db=db, tenant_id=tenant_id)
    return promotion_service.promote_semester_for_grade(
        grade=grade,
        section=section,
        target_semester=target_semester
    )

@router.post("/enrollments/promote-grade")
@has_permission("promote_students")
def promote_grade_level(
    *,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_from_request),
    from_grade: str = Body(...),
    from_section: Optional[str] = Body(None),
    target_academic_year: str = Body(...),
    target_section_mapping: Optional[Dict[str, str]] = Body(None),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Promote all students in a grade/section to next grade."""
    promotion_service = PromotionService(db=db, tenant_id=tenant_id)
    return promotion_service.promote_grade_level(
        from_grade=from_grade,
        from_section=from_section,
        target_academic_year=target_academic_year,
        target_section_mapping=target_section_mapping
    )

@router.get("/enrollments/semester-report")
@has_permission("view_enrollment")
def get_semester_report(
    *,
    enrollment_service: EnrollmentService = Depends(),
    academic_year: str = Query(...),
    semester: int = Query(..., ge=1, le=2),
    grade: Optional[str] = None
) -> Any:
    """Get semester completion report."""
    # Implementation for semester progress reporting
    pass
# top imports section
from typing import Any, List, Optional
from src.schemas.academics.enrollment import Enrollment
from src.services.academics.enrollment import EnrollmentService
# near the bottom of the file, after the enrollment endpoints
@router.get("/students/{student_id}/enrollments", response_model=List[Enrollment])
def get_student_enrollments(
    *,
    student_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100,
):
    enrollments = enrollment_service.get_multi(
        db=db,
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        student_id=str(student_id),
    )
    return enrollments
@router.get("/students/{student_id}/enrollments/current", response_model=Enrollment | None)
def get_student_current_enrollment(
    *,
    student_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    enrollment_service = EnrollmentService(tenant_id=tenant_id, db=db)
    current_enrollment = enrollment_service.get_active_enrollment(student_id=str(student_id))
    if current_enrollment is None:
        return None
    return current_enrollment
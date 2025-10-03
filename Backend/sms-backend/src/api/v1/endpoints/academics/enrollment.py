from typing import Any, List, Optional, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session

from src.services.academics.enrollment import EnrollmentService
from src.db.session import get_db
from src.schemas.academics.enrollment import (
    Enrollment, 
    EnrollmentCreate, 
    EnrollmentUpdate, 
    EnrollmentWithStudent
)
from src.core.middleware.tenant import get_tenant_from_request
from src.core.auth.dependencies import has_any_role, get_current_user, has_permission
from src.schemas.auth import User
from src.core.exceptions.business import (
    EntityNotFoundError,
    DuplicateEntityError,
    InvalidStatusTransitionError,
    BusinessRuleViolationError
)

router = APIRouter()

# Enrollment endpoints
@router.get("/enrollments", response_model=Dict[str, Any])
def get_enrollments(
    *,
    enrollment_service: EnrollmentService = Depends(),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    academic_year_id: Optional[str] = Query(None, description="Filter by academic year"),
    grade_id: Optional[str] = Query(None, description="Filter by grade"),
    section_id: Optional[str] = Query(None, description="Filter by section"),
    status: Optional[str] = Query(None, description="Filter by enrollment status"),
    search: Optional[str] = Query(None, description="Search by student name or admission number"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get all enrollments for a tenant with pagination and filtering."""
    try:
        # Build filters dictionary
        filters = {}
        if academic_year_id:
            filters["academic_year"] = academic_year_id
        if grade_id:
            filters["grade"] = grade_id
        if section_id:
            filters["section"] = section_id
        if status:
            filters["status"] = status
        
        # Get enrollments with pagination
        enrollments = enrollment_service.get_multi(skip=skip, limit=limit, **filters)
        
        # Get total count for pagination
        total_count = enrollment_service.count(**filters)
        
        return {
            "items": enrollments,
            "total": total_count,
            "skip": skip,
            "limit": limit,
            "has_next": (skip + limit) < total_count,
            "has_prev": skip > 0
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch enrollments: {str(e)}"
        )

@router.post("/enrollments", response_model=Enrollment, status_code=status.HTTP_201_CREATED)
def create_enrollment(
    *,
    enrollment_service: EnrollmentService = Depends(),
    enrollment_in: EnrollmentCreate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Create a new enrollment (requires admin or teacher role)."""
    try:
        return enrollment_service.create(obj_in=enrollment_in)
    except EntityNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except DuplicateEntityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except BusinessRuleViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create enrollment: {str(e)}"
        )

@router.get("/enrollments/{enrollment_id}", response_model=Enrollment)
def get_enrollment(
    *,
    enrollment_service: EnrollmentService = Depends(),
    enrollment_id: UUID,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get a specific enrollment by ID."""
    try:
        enrollment = enrollment_service.get(id=enrollment_id)
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Enrollment with ID {enrollment_id} not found"
            )
        return enrollment
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch enrollment: {str(e)}"
        )

@router.put("/enrollments/{enrollment_id}", response_model=Enrollment)
def update_enrollment(
    *,
    enrollment_service: EnrollmentService = Depends(),
    enrollment_id: UUID,
    enrollment_in: EnrollmentUpdate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Update an enrollment (requires admin or teacher role)."""
    try:
        # Check if enrollment exists
        existing_enrollment = enrollment_service.get(id=enrollment_id)
        if not existing_enrollment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Enrollment with ID {enrollment_id} not found"
            )
        
        # Update the enrollment
        updated_enrollment = enrollment_service.update(id=enrollment_id, obj_in=enrollment_in)
        return updated_enrollment
    except HTTPException:
        raise
    except InvalidStatusTransitionError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except BusinessRuleViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update enrollment: {str(e)}"
        )

@router.delete("/enrollments/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_enrollment(
    *,
    enrollment_service: EnrollmentService = Depends(),
    enrollment_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
):
    """Delete an enrollment (requires admin role)."""
    try:
        # Check if enrollment exists
        existing_enrollment = enrollment_service.get(id=enrollment_id)
        if not existing_enrollment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Enrollment with ID {enrollment_id} not found"
            )
        
        # Delete the enrollment
        enrollment_service.remove(id=enrollment_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete enrollment: {str(e)}"
        )

@router.post("/enrollments/bulk", response_model=List[Enrollment], status_code=status.HTTP_201_CREATED)
def bulk_create_enrollments(
    *,
    enrollment_service: EnrollmentService = Depends(),
    bulk_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Create multiple enrollments at once (requires admin or teacher role)."""
    try:
        # Extract data from bulk request
        student_ids = bulk_data.get("student_ids", [])
        academic_year_id = bulk_data.get("academic_year_id")
        grade_id = bulk_data.get("grade_id")
        section_id = bulk_data.get("section_id")
        semester = bulk_data.get("semester")
        enrollment_date = bulk_data.get("enrollment_date")
        
        if not student_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="student_ids is required and cannot be empty"
            )
        
        if not all([academic_year_id, grade_id, section_id]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="academic_year_id, grade_id, and section_id are required"
            )
        
        # Create enrollments for each student
        created_enrollments = []
        failed_enrollments = []
        
        for student_id in student_ids:
            try:
                enrollment_data = EnrollmentCreate(
                    student_id=UUID(student_id),
                    academic_year=academic_year_id,
                    grade=grade_id,
                    section=section_id,
                    semester=semester,
                    enrollment_date=enrollment_date,
                    status="active",
                    is_active=True
                )
                
                enrollment = enrollment_service.create(obj_in=enrollment_data)
                created_enrollments.append(enrollment)
            except Exception as e:
                failed_enrollments.append({
                    "student_id": student_id,
                    "error": str(e)
                })
        
        # If some enrollments failed, include that information
        if failed_enrollments:
            raise HTTPException(
                status_code=status.HTTP_207_MULTI_STATUS,
                detail={
                    "message": f"Created {len(created_enrollments)} enrollments, {len(failed_enrollments)} failed",
                    "created": created_enrollments,
                    "failed": failed_enrollments
                }
            )
        
        return created_enrollments
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create bulk enrollments: {str(e)}"
        )

# Additional utility endpoints
@router.get("/enrollments/{enrollment_id}/with-student", response_model=EnrollmentWithStudent)
def get_enrollment_with_student(
    *,
    enrollment_service: EnrollmentService = Depends(),
    enrollment_id: UUID,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get enrollment with student details."""
    try:
        enrollment_data = enrollment_service.get_with_student_details(id=enrollment_id)
        if not enrollment_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Enrollment with ID {enrollment_id} not found"
            )
        return enrollment_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch enrollment with student details: {str(e)}"
        )

@router.put("/enrollments/{enrollment_id}/status", response_model=Enrollment)
def update_enrollment_status(
    *,
    enrollment_service: EnrollmentService = Depends(),
    enrollment_id: UUID,
    status_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Update enrollment status with validation."""
    try:
        new_status = status_data.get("status")
        withdrawal_date = status_data.get("withdrawal_date")
        withdrawal_reason = status_data.get("withdrawal_reason")
        
        if not new_status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="status is required"
            )
        
        updated_enrollment = enrollment_service.update_status(
            id=enrollment_id,
            status=new_status,
            withdrawal_date=withdrawal_date,
            withdrawal_reason=withdrawal_reason
        )
        
        return updated_enrollment
        
    except EntityNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except InvalidStatusTransitionError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update enrollment status: {str(e)}"
        )
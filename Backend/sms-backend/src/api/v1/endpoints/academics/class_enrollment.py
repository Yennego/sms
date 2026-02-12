from typing import Any, List, Optional, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, Response
from sqlalchemy.orm import Session

from src.services.academics.class_enrollment_service import ClassEnrollmentService
from src.db.session import get_db
from src.schemas.academics.class_enrollment import (
    ClassEnrollment, 
    ClassEnrollmentCreate, 
    ClassEnrollmentUpdate, 
    ClassEnrollmentWithDetails,
    BulkClassEnrollmentCreate,
    ClassEnrollmentSummary
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
import csv
import io
from openpyxl import Workbook

router = APIRouter()

# Class Enrollment endpoints
@router.get("/class-enrollments", response_model=Dict[str, Any])
async def get_class_enrollments(
    *,
    class_enrollment_service: ClassEnrollmentService = Depends(),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    class_id: Optional[UUID] = Query(None, description="Filter by class ID"),
    student_id: Optional[UUID] = Query(None, description="Filter by student ID"),
    academic_year_id: Optional[UUID] = Query(None, description="Filter by academic year"),
    status: Optional[str] = Query(None, description="Filter by enrollment status"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get all class enrollments for a tenant with pagination and filtering."""
    try:
        # Build filters dictionary
        filters = {}
        if class_id:
            filters["class_id"] = class_id
        if student_id:
            filters["student_id"] = student_id
        if academic_year_id:
            filters["academic_year_id"] = academic_year_id
        if status:
            filters["status"] = status
        if is_active is not None:
            filters["is_active"] = is_active
        
        # Get enrollments with pagination
        enrollments = await class_enrollment_service.get_multi(skip=skip, limit=limit, **filters)
        
        # Get total count for pagination
        total_count = await class_enrollment_service.count(**filters)
        
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
            detail=f"Failed to fetch class enrollments: {str(e)}"
        )

@router.post("/class-enrollments", response_model=ClassEnrollment, status_code=status.HTTP_201_CREATED)
async def create_class_enrollment(
    *,
    class_enrollment_service: ClassEnrollmentService = Depends(),
    enrollment_in: ClassEnrollmentCreate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Enroll a student in a class (requires admin or teacher role)."""
    try:
        return await class_enrollment_service.enroll_student(obj_in=enrollment_in)
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
            detail=f"Failed to create class enrollment: {str(e)}"
        )

@router.post("/class-enrollments/bulk", response_model=List[ClassEnrollment], status_code=status.HTTP_201_CREATED)
async def bulk_create_class_enrollments(
    *,
    class_enrollment_service: ClassEnrollmentService = Depends(),
    bulk_data: BulkClassEnrollmentCreate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Bulk enroll multiple students in a class (requires admin or teacher role)."""
    try:
        result = await class_enrollment_service.bulk_enroll_students(bulk_data=bulk_data)
        created = result.get("created", [])
        failed = result.get("failed", [])

        if failed:
            raise HTTPException(
                status_code=status.HTTP_207_MULTI_STATUS,
                detail={
                    "message": f"Created {len(created)} enrollments, {len(failed)} failed",
                    "created": created,
                    "failed": failed,
                }
            )
        return created
    except EntityNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk create class enrollments: {str(e)}"
        )

@router.get("/class-enrollments/{enrollment_id}", response_model=ClassEnrollment)
async def get_class_enrollment(
    *,
    class_enrollment_service: ClassEnrollmentService = Depends(),
    enrollment_id: UUID,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get a specific class enrollment by ID."""
    try:
        enrollment = await class_enrollment_service.get(id=enrollment_id)
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Class enrollment with ID {enrollment_id} not found"
            )
        return enrollment
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch class enrollment: {str(e)}"
        )

@router.get("/class-enrollments/{enrollment_id}/details", response_model=ClassEnrollmentWithDetails)
async def get_class_enrollment_with_details(
    *,
    class_enrollment_service: ClassEnrollmentService = Depends(),
    enrollment_id: UUID,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get class enrollment with student and class details."""
    try:
        enrollment_data = await class_enrollment_service.get_with_details(id=enrollment_id)
        if not enrollment_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Class enrollment with ID {enrollment_id} not found"
            )
        return enrollment_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch class enrollment details: {str(e)}"
        )

@router.put("/class-enrollments/{enrollment_id}", response_model=ClassEnrollment)
async def update_class_enrollment(
    *,
    class_enrollment_service: ClassEnrollmentService = Depends(),
    enrollment_id: UUID,
    enrollment_in: ClassEnrollmentUpdate,
    current_user: User = Depends(has_permission("manage_students"))
) -> Any:
    """Update a class enrollment (requires admin or teacher role)."""
    try:
        # Check if enrollment exists
        existing_enrollment = await class_enrollment_service.get(id=enrollment_id)
        if not existing_enrollment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Class enrollment with ID {enrollment_id} not found"
            )
        
        # Update the enrollment
        updated_enrollment = await class_enrollment_service.update(id=enrollment_id, obj_in=enrollment_in)
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
            detail=f"Failed to update class enrollment: {str(e)}"
        )

@router.delete("/class-enrollments/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_class_enrollment(
    *,
    class_enrollment_service: ClassEnrollmentService = Depends(),
    enrollment_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
):
    """Delete a class enrollment (requires admin role)."""
    try:
        # Check if enrollment exists
        existing_enrollment = await class_enrollment_service.get(id=enrollment_id)
        if not existing_enrollment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Class enrollment with ID {enrollment_id} not found"
            )
        
        # Delete the enrollment
        await class_enrollment_service.delete(id=enrollment_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete class enrollment: {str(e)}"
        )

# Specific action endpoints
@router.put("/class-enrollments/{enrollment_id}/drop", response_model=ClassEnrollment)
async def drop_student_from_class(
    *,
    class_enrollment_service: ClassEnrollmentService = Depends(),
    enrollment_id: UUID,
    drop_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(has_permission("manage_students"))
) -> Any:
    """Drop a student from a class."""
    try:
        drop_date = drop_data.get("drop_date")
        return await class_enrollment_service.drop_student_from_class(
            enrollment_id=enrollment_id,
            drop_date=drop_date
        )
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
            detail=f"Failed to drop student from class: {str(e)}"
        )

@router.put("/class-enrollments/{enrollment_id}/complete", response_model=ClassEnrollment)
async def complete_student_enrollment(
    *,
    class_enrollment_service: ClassEnrollmentService = Depends(),
    enrollment_id: UUID,
    completion_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Mark a student's enrollment as completed."""
    try:
        completion_date = completion_data.get("completion_date")
        return await class_enrollment_service.complete_student_enrollment(
            enrollment_id=enrollment_id,
            completion_date=completion_date
        )
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
            detail=f"Failed to complete student enrollment: {str(e)}"
        )

@router.put("/class-enrollments/{enrollment_id}/reactivate", response_model=ClassEnrollment)
async def reactivate_enrollment(
    *,
    class_enrollment_service: ClassEnrollmentService = Depends(),
    enrollment_id: UUID,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Reactivate a dropped enrollment."""
    try:
        return await class_enrollment_service.reactivate_enrollment(enrollment_id=enrollment_id)
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
            detail=f"Failed to reactivate enrollment: {str(e)}"
        )

# Query endpoints
@router.get("/classes/{class_id}/enrollments", response_model=List[ClassEnrollmentWithDetails])
async def get_students_in_class(
    *,
    class_enrollment_service: ClassEnrollmentService = Depends(),
    class_id: UUID,
    academic_year_id: Optional[UUID] = Query(None, description="Filter by academic year"),
    is_active: bool = Query(True, description="Filter by active status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(200, ge=1, le=1000, description="Number of records to return"),
    current_user: User = Depends(has_permission("view_students"))
) -> Any:
    """Get all students enrolled in a specific class."""
    try:
        return await class_enrollment_service.get_students_in_class(
            class_id=class_id,
            academic_year_id=academic_year_id,
            is_active=is_active,
            skip=skip,
            limit=limit
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch students in class: {str(e)}"
        )

@router.get("/students/{student_id}/class-enrollments", response_model=List[ClassEnrollment])
async def get_student_classes(
    *,
    class_enrollment_service: ClassEnrollmentService = Depends(),
    student_id: UUID,
    academic_year_id: Optional[UUID] = Query(None, description="Filter by academic year"),
    is_active: bool = Query(True, description="Filter by active status"),
    current_user: User = Depends(has_any_role(["admin", "teacher", "student", "parent"]))
) -> Any:
    """Get all classes a student is enrolled in."""
    try:
        return await class_enrollment_service.get_student_classes(
            student_id=student_id,
            academic_year_id=academic_year_id,
            is_active=is_active
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch student classes: {str(e)}"
        )

@router.get("/classes/{class_id}/enrollment-count", response_model=Dict[str, int])
async def get_class_enrollment_count(
    *,
    class_enrollment_service: ClassEnrollmentService = Depends(),
    class_id: UUID,
    academic_year_id: Optional[UUID] = Query(None, description="Filter by academic year"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    status_filter: Optional[str] = Query(None, description="Filter by enrollment status"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get the number of students enrolled in a class."""
    try:
        count = await class_enrollment_service.get_class_enrollment_count(
            class_id=class_id,
            academic_year_id=academic_year_id,
            is_active=is_active,
            status=status_filter,
        )
        return {"count": count}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get class enrollment count: {str(e)}"
        )

@router.get("/classes/{class_id}/enrollments/count", response_model=Dict[str, int])
async def get_class_enrollment_count_alias(
    *,
    class_enrollment_service: ClassEnrollmentService = Depends(),
    class_id: UUID,
    academic_year_id: Optional[UUID] = Query(None, description="Filter by academic year"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    status_filter: Optional[str] = Query(None, description="Filter by enrollment status"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Alias route for class enrollment count."""
    try:
        count = await class_enrollment_service.get_class_enrollment_count(
            class_id=class_id,
            academic_year_id=academic_year_id,
            is_active=is_active,
            status=status_filter,
        )
        return {"count": count}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get class enrollment count: {str(e)}"
        )

@router.get("/classes/{class_id}/enrollments/export")
async def export_class_enrollments(
    *,
    class_enrollment_service: ClassEnrollmentService = Depends(),
    class_id: UUID,
    academic_year_id: Optional[UUID] = Query(None, description="Filter by academic year"),
    is_active: Optional[bool] = Query(True, description="Filter by active status"),
    format: str = Query("csv", description="Export format: csv or xlsx"),
    details: bool = Query(False, description="Include student/class/year names"),
    current_user: User = Depends(has_permission("view_students"))
) -> Any:
    """Export class enrollments as CSV. XLSX can be added next."""
    try:
        enrollments = await class_enrollment_service.get_students_in_class(
            class_id=class_id,
            academic_year_id=academic_year_id,
            is_active=is_active
        )

        if format.lower() == "csv":
            output = io.StringIO()
            writer = csv.writer(output)

            if details:
                writer.writerow([
                    "id", "student_id", "class_id", "academic_year_id",
                    "enrollment_date", "status", "is_active",
                    "drop_date", "completion_date",
                    "created_at", "updated_at",
                    "student_name", "student_admission_number", "class_name", "academic_year_name"
                ])
                for e in enrollments:
                    d = await class_enrollment_service.get_with_details(id=e.id) or e
                    writer.writerow([
                        str(e.id), str(e.student_id), str(e.class_id), str(e.academic_year_id),
                        e.enrollment_date.isoformat() if e.enrollment_date else "",
                        e.status, str(e.is_active),
                        e.drop_date.isoformat() if e.drop_date else "",
                        e.completion_date.isoformat() if e.completion_date else "",
                        e.created_at.isoformat(), e.updated_at.isoformat(),
                        getattr(d, "student_name", None) or "",
                        getattr(d, "student_admission_number", None) or "",
                        getattr(d, "class_name", None) or "",
                        getattr(d, "academic_year_name", None) or "",
                    ])
            else:
                writer.writerow([
                    "id", "student_id", "class_id", "academic_year_id",
                    "enrollment_date", "status", "is_active",
                    "drop_date", "completion_date",
                    "created_at", "updated_at"
                ])
                for e in enrollments:
                    writer.writerow([
                        str(e.id), str(e.student_id), str(e.class_id), str(e.academic_year_id),
                        e.enrollment_date.isoformat() if e.enrollment_date else "",
                        e.status, str(e.is_active),
                        e.drop_date.isoformat() if e.drop_date else "",
                        e.completion_date.isoformat() if e.completion_date else "",
                        e.created_at.isoformat(), e.updated_at.isoformat()
                    ])

            headers = {
                "Content-Disposition": f'attachment; filename="class_{class_id}_enrollments.csv"'
            }
            return Response(content=output.getvalue(), media_type="text/csv", headers=headers)

        if format.lower() == "xlsx":
            wb = Workbook()
            ws = wb.active
            if details:
                headers = [
                    "id", "student_id", "class_id", "academic_year_id",
                    "enrollment_date", "status", "is_active",
                    "drop_date", "completion_date",
                    "created_at", "updated_at",
                    "student_name", "student_admission_number", "class_name", "academic_year_name"
                ]
            else:
                headers = [
                    "id", "student_id", "class_id", "academic_year_id",
                    "enrollment_date", "status", "is_active",
                    "drop_date", "completion_date",
                    "created_at", "updated_at"
                ]
            ws.append(headers)
        
            for e in enrollments:
                if details:
                    d = await class_enrollment_service.get_with_details(id=e.id) or e
                    row = [
                        str(e.id), str(e.student_id), str(e.class_id), str(e.academic_year_id),
                        e.enrollment_date.isoformat() if e.enrollment_date else "",
                        e.status, str(e.is_active),
                        e.drop_date.isoformat() if e.drop_date else "",
                        e.completion_date.isoformat() if e.completion_date else "",
                        e.created_at.isoformat(), e.updated_at.isoformat(),
                        getattr(d, "student_name", None) or "",
                        getattr(d, "student_admission_number", None) or "",
                        getattr(d, "class_name", None) or "",
                        getattr(d, "academic_year_name", None) or "",
                    ]
                else:
                    row = [
                        str(e.id), str(e.student_id), str(e.class_id), str(e.academic_year_id),
                        e.enrollment_date.isoformat() if e.enrollment_date else "",
                        e.status, str(e.is_active),
                        e.drop_date.isoformat() if e.drop_date else "",
                        e.completion_date.isoformat() if e.completion_date else "",
                        e.created_at.isoformat(), e.updated_at.isoformat(),
                    ]
                ws.append(row)
        
            buf = io.BytesIO()
            wb.save(buf)
            buf.seek(0)
            headers = {
                "Content-Disposition": f'attachment; filename="class_{class_id}_enrollments.xlsx"'
            }
            return Response(content=buf.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)

        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Excel export (xlsx) not implemented yet"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export enrollments: {str(e)}"
        )

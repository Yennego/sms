from typing import Any, List, Optional
from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from src.db.models.academics.class_model import Class as ClassModel
from src.db.models.academics.class_subject import ClassSubject as ClassSubjectModel
from src.db.models.academics.enrollment import Enrollment as EnrollmentModel
from src.services.academics.class_service import ClassService, SuperAdminClassService
from src.services.academics.enrollment import EnrollmentService
from src.db.session import get_db
from src.schemas.academics.class_schema import Class, ClassCreate, ClassUpdate, ClassWithDetails
from src.schemas.academics.class_subject_schema import ClassSubject as ClassSubjectSchema, ClassSubjectCreate, ClassSubjectUpdate
from src.services.academics.class_subject_service import ClassSubjectService
from src.schemas.people.student import Student
from src.core.middleware.tenant import get_tenant_from_request
from src.core.auth.dependencies import has_any_role, get_current_user, has_permission
from src.schemas.auth import User
from src.core.exceptions.business import (
    BusinessLogicError,
    EntityNotFoundError,
    DuplicateEntityError,
    BusinessRuleViolationError
)

router = APIRouter()

# Class endpoints
@router.post("/classes", response_model=Class, status_code=status.HTTP_201_CREATED)
async def create_class(
    *,
    class_service: ClassService = Depends(),
    class_in: ClassCreate,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Create a new class (requires admin or teacher role)."""
    try:
        return await class_service.create(obj_in=class_in)
    except DuplicateEntityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/classes", response_model=List[ClassWithDetails])
async def get_classes(
    *,
    class_service: ClassService = Depends(),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    academic_year_id: Optional[UUID] = None,
    grade_id: Optional[UUID] = None,
    section_id: Optional[UUID] = None,
    subject_id: Optional[UUID] = None,
    teacher_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get all classes for a tenant with optional filtering."""
    filters = {}
    if academic_year_id:
        filters["academic_year_id"] = academic_year_id
    if grade_id:
        filters["grade_id"] = grade_id
    if section_id:
        filters["section_id"] = section_id
    if subject_id:
        filters["subject_id"] = subject_id
    if teacher_id:
        filters["teacher_id"] = teacher_id
    if is_active is not None:
        filters["is_active"] = is_active
    
    try:
        # Simplified approach: get classes without complex nested joins
        # The subjects relationship uses selectin by default in the model
        options = [
            joinedload(ClassModel.grade),
            joinedload(ClassModel.section),
            joinedload(ClassModel.academic_year),
            joinedload(ClassModel.class_teacher),
            joinedload(ClassModel.subjects)
        ]
        classes = await class_service.list(skip=skip, limit=limit, filters=filters, options=options)
        
        results = []
        for class_obj in classes:
            # Convert to ClassWithDetails
            result_dict = {
                "id": class_obj.id,
                "tenant_id": class_obj.tenant_id,
                "created_at": class_obj.created_at,
                "updated_at": class_obj.updated_at,
                "name": class_obj.name,
                "academic_year_id": class_obj.academic_year_id,
                "description": class_obj.description,
                "room": class_obj.room,
                "capacity": class_obj.capacity,
                "is_active": class_obj.is_active,
                "start_date": class_obj.start_date,
                "end_date": class_obj.end_date,
                "grade_id": class_obj.grade_id,
                "section_id": class_obj.section_id,
                "class_teacher_id": class_obj.class_teacher_id,
                "grade_name": class_obj.grade.name if class_obj.grade else "Unknown Grade",
                "section_name": class_obj.section.name if class_obj.section else "Unknown Section",
                "academic_year_name": class_obj.academic_year.name if class_obj.academic_year else "Unknown Year",
                "class_teacher_name": (f"{class_obj.class_teacher.first_name or ''} {class_obj.class_teacher.last_name or ''}".strip() or "Unknown") if class_obj.class_teacher else "Unassigned",
                "subjects": class_obj.subjects
            }
            results.append(ClassWithDetails(**result_dict))
        return results
    except BusinessLogicError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        import traceback
        print(f"Error fetching classes: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch classes: {str(e)}"
        )

@router.get("/classes/{class_id}", response_model=Class)
async def get_class(
    *,
    class_service: ClassService = Depends(),
    class_id: UUID
) -> Any:
    """Get a specific class by ID."""
    class_obj = await class_service.get(id=class_id)
    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with ID {class_id} not found"
        )
    return class_obj

@router.put("/classes/{class_id}", response_model=Class)
async def update_class(
    *,
    class_service: ClassService = Depends(),
    class_id: UUID,
    class_in: ClassUpdate,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Update a class."""
    try:
        class_obj = await class_service.get(id=class_id)
        if not class_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Class with ID {class_id} not found"
            )
        return await class_service.update(id=class_id, obj_in=class_in)
    except BusinessLogicError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/classes/{class_id}", response_model=Class)
async def delete_class(
    *,
    class_service: ClassService = Depends(),
    class_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Delete a class (admin only)."""
    class_obj = await class_service.get(id=class_id)
    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with ID {class_id} not found"
        )
    return await class_service.delete(id=class_id)

@router.get("/classes/{class_id}/students", response_model=List[Student])
async def get_students_by_class(
    *,
    class_service: ClassService = Depends(),
    enrollment_service: EnrollmentService = Depends(),
    class_id: UUID,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Get all students enrolled in a specific class using IDs."""
    class_obj = await class_service.get(id=class_id)
    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with ID {class_id} not found"
        )
    
    # Use IDs from the class object to find enrollments
    # Use the current academic year ID from the class directly
    ayid = class_obj.academic_year_id
    
    # Debug logging
    print(f"[DEBUG] get_students_by_class: class_id={class_id}")
    print(f"[DEBUG] Filtering by: academic_year_id={ayid}, grade_id={class_obj.grade_id}, section_id={class_obj.section_id}")

    # Use IDs for lookup with joinedload for student details
    options = [joinedload(EnrollmentModel.student)]
    enrollments = await enrollment_service.get_multi(
        academic_year_id=ayid,
        grade_id=class_obj.grade_id,
        section_id=class_obj.section_id,
        is_active=True,
        options=options
    )
    
    print(f"[DEBUG] Found {len(enrollments)} enrollments")
    for e in enrollments:
        print(f"[DEBUG]   - Enrollment: student={e.student_id}, status={e.status}, is_active={e.is_active}")
    
    students = [enrollment.student for enrollment in enrollments if enrollment.student]
    print(f"[DEBUG] Returning {len(students)} students")
    return students

@router.post("/classes/{class_id}/subjects", response_model=ClassSubjectSchema)
async def add_subject_to_class(
    *,
    class_subject_service: ClassSubjectService = Depends(),
    class_id: UUID,
    subject_in: ClassSubjectCreate,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Add or update a subject in a class."""
    return await class_subject_service.add_subject_to_class(class_id, subject_in)

@router.delete("/classes/{class_id}/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_subject_from_class(
    *,
    class_subject_service: ClassSubjectService = Depends(),
    class_id: UUID,
    subject_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
):
    """Remove a subject from a class."""
    await class_subject_service.remove_subject_from_class(class_id, subject_id)
    return None

@router.get("/classes/{class_id}/details", response_model=ClassWithDetails)
async def get_class_details(
    *,
    class_service: ClassService = Depends(),
    class_id: UUID,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get a class with embedded relationship names."""
    class_obj = await class_service.get(id=class_id)
    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with ID {class_id} not found"
        )

    # Base fields via Pydantic from attributes
    base = Class.model_validate(class_obj, from_attributes=True)
    return ClassWithDetails.model_validate(
        {
            **base.model_dump(),
            "grade_name": getattr(class_obj.grade, "name", "Unknown"),
            "section_name": getattr(class_obj.section, "name", "Unknown"),
            "academic_year_name": getattr(class_obj.academic_year, "name", "Unknown"),
            "class_teacher_name": " ".join(
                [p for p in [getattr(class_obj.class_teacher, "first_name", None), getattr(class_obj.class_teacher, "last_name", None)] if p]
            ) or getattr(class_obj.class_teacher, "email", "Unassigned"),
            "subjects": class_obj.subjects
        }
    )
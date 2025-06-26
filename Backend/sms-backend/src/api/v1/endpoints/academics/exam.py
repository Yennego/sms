from typing import Any, List, Optional
from uuid import UUID
from datetime import date, time

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from src.services.academics import ExamService, SuperAdminExamService
from src.db.session import get_db
from src.schemas.academics.exam import Exam, ExamCreate, ExamUpdate, ExamWithDetails
from src.core.middleware.tenant import get_tenant_from_request
from src.core.auth.dependencies import has_any_role, get_current_user, has_permission
from src.schemas.auth import User
from src.core.exceptions.business import (
    BusinessLogicError,
    EntityNotFoundError,
    DuplicateEntityError,
    BusinessRuleViolationError,
    DatabaseError
)

router = APIRouter()

# Exam endpoints
@router.post("/exams", response_model=Exam, status_code=status.HTTP_201_CREATED)
def create_exam(
    *,
    exam_service: ExamService = Depends(),
    exam_in: ExamCreate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Create a new exam (requires admin or teacher role)."""
    try:
        return exam_service.create(obj_in=exam_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/exams", response_model=List[Exam])
def get_exams(
    *,
    exam_service: ExamService = Depends(),
    skip: int = 0,
    limit: int = 100,
    subject_id: Optional[UUID] = None,
    teacher_id: Optional[UUID] = None,
    grade_id: Optional[UUID] = None,
    section_id: Optional[UUID] = None,
    is_published: Optional[bool] = None
) -> Any:
    """Get all exams for a tenant with optional filtering."""
    filters = {}
    if subject_id:
        filters["subject_id"] = subject_id
    if teacher_id:
        filters["teacher_id"] = teacher_id
    if grade_id:
        filters["grade_id"] = grade_id
    if section_id:
        filters["section_id"] = section_id
    if is_published is not None:
        filters["is_published"] = is_published
    
    return exam_service.get_multi(skip=skip, limit=limit, **filters)

@router.get("/exams/{exam_id}", response_model=Exam)
def get_exam(
    *,
    exam_service: ExamService = Depends(),
    exam_id: UUID
) -> Any:
    """Get a specific exam by ID."""
    exam = exam_service.get(id=exam_id)
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exam with ID {exam_id} not found"
        )
    return exam

@router.put("/exams/{exam_id}", response_model=Exam)
def update_exam(
    *,
    exam_service: ExamService = Depends(),
    exam_id: UUID,
    exam_in: ExamUpdate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Update an exam."""
    try:
        exam = exam_service.get(id=exam_id)
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Exam with ID {exam_id} not found"
            )
        return exam_service.update(db_obj=exam, obj_in=exam_in)
    except BusinessRuleViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/exams/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exam(
    *,
    exam_service: ExamService = Depends(),
    exam_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
) -> None:
    """Delete an exam (admin only)."""
    exam = exam_service.get(id=exam_id)
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exam with ID {exam_id} not found"
        )
    exam_service.remove(id=exam_id)

@router.put("/exams/{exam_id}/publish", response_model=Exam)
def publish_exam(
    *,
    exam_service: ExamService = Depends(),
    exam_id: UUID,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Publish an exam to make it visible to students."""
    try:
        return exam_service.update_publication_status(id=exam_id, is_published=True)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exam with ID {exam_id} not found"
        )
    except BusinessRuleViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.put("/exams/{exam_id}/unpublish", response_model=Exam)
def unpublish_exam(
    *,
    exam_service: ExamService = Depends(),
    exam_id: UUID,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Unpublish an exam to hide it from students."""
    try:
        return exam_service.update_publication_status(id=exam_id, is_published=False)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exam with ID {exam_id} not found"
        )
    except BusinessRuleViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# Super Admin endpoints
@router.get("/super-admin/exams", response_model=List[Exam])
def get_all_exams(
    *,
    exam_service: SuperAdminExamService = Depends(),
    skip: int = 0,
    limit: int = 100,
    subject_id: Optional[UUID] = None,
    teacher_id: Optional[UUID] = None,
    grade_id: Optional[UUID] = None,
    is_published: Optional[bool] = None,
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(has_permission("view_all_exams"))
) -> Any:
    """Get all exams across all tenants with filtering (super-admin only)."""
    return exam_service.get_all_exams(
        skip=skip,
        limit=limit,
        subject_id=subject_id,
        teacher_id=teacher_id,
        grade_id=grade_id,
        is_published=is_published,
        tenant_id=tenant_id
    )
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from src.services.academics.subject_service import SubjectService, SuperAdminSubjectService
from src.db.session import get_db
from src.schemas.academics.subject import Subject, SubjectCreate, SubjectUpdate
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

# Subject endpoints
@router.post("/subjects", response_model=Subject, status_code=status.HTTP_201_CREATED)
def create_subject(
    *,
    subject_service: SubjectService = Depends(),
    subject_in: SubjectCreate,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Create a new subject (requires admin role)."""
    try:
        return subject_service.create(obj_in=subject_in)
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

@router.get("/subjects", response_model=List[Subject])
def get_subjects(
    *,
    subject_service: SubjectService = Depends(),
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get all subjects for a tenant with optional filtering (requires authentication)."""
    if is_active is not None:
        if is_active:
            return subject_service.get_active_subjects(skip=skip, limit=limit)
        else:
            filters = {"is_active": False}
            return subject_service.list(skip=skip, limit=limit, filters=filters)
    else:
        return subject_service.list(skip=skip, limit=limit)

@router.get("/subjects/{subject_id}", response_model=Subject)
def get_subject(
    *,
    subject_service: SubjectService = Depends(),
    subject_id: UUID,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get a specific subject by ID."""
    subject_obj = subject_service.get(id=subject_id)
    if not subject_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subject with ID {subject_id} not found"
        )
    return subject_obj

@router.get("/subjects/code/{code}", response_model=Subject)
def get_subject_by_code(
    *,
    subject_service: SubjectService = Depends(),
    code: str,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get a specific subject by code."""
    subject_obj = subject_service.get_by_code(code=code)
    if not subject_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subject with code {code} not found"
        )
    return subject_obj

@router.put("/subjects/{subject_id}", response_model=Subject)
def update_subject(
    *,
    subject_service: SubjectService = Depends(),
    subject_id: UUID,
    subject_in: SubjectUpdate,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Update a subject (admin only)."""
    try:
        subject_obj = subject_service.get(id=subject_id)
        if not subject_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Subject with ID {subject_id} not found"
            )
        return subject_service.update(id=subject_id, obj_in=subject_in)
    except DuplicateEntityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except BusinessLogicError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/subjects/{subject_id}", response_model=Subject)
def delete_subject(
    *,
    subject_service: SubjectService = Depends(),
    subject_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Delete a subject (admin only)."""
    subject_obj = subject_service.get(id=subject_id)
    if not subject_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subject with ID {subject_id} not found"
        )
    return subject_service.delete(id=subject_id)
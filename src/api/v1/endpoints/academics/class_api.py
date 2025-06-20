from typing import Any, List, Optional
from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from src.services.academics.class_service import ClassService, SuperAdminClassService
from src.db.session import get_db
from src.schemas.academics.class_schema import Class, ClassCreate, ClassUpdate, ClassWithDetails
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
def create_class(
    *,
    class_service: ClassService = Depends(),
    class_in: ClassCreate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Create a new class (requires admin or teacher role)."""
    try:
        return class_service.create(obj_in=class_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/classes", response_model=List[Class])
def get_classes(
    *,
    class_service: ClassService = Depends(),
    skip: int = 0,
    limit: int = 100,
    academic_year: Optional[str] = None,
    grade_id: Optional[UUID] = None,
    section_id: Optional[UUID] = None,
    subject_id: Optional[UUID] = None,
    teacher_id: Optional[UUID] = None,
    is_active: Optional[bool] = None
) -> Any:
    """Get all classes for a tenant with optional filtering."""
    filters = {}
    if academic_year:
        filters["academic_year"] = academic_year
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
    
    return class_service.list(skip=skip, limit=limit, filters=filters)

@router.get("/classes/{class_id}", response_model=Class)
def get_class(
    *,
    class_service: ClassService = Depends(),
    class_id: UUID
) -> Any:
    """Get a specific class by ID."""
    class_obj = class_service.get(id=class_id)
    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with ID {class_id} not found"
        )
    return class_obj

@router.put("/classes/{class_id}", response_model=Class)
def update_class(
    *,
    class_service: ClassService = Depends(),
    class_id: UUID,
    class_in: ClassUpdate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Update a class."""
    try:
        class_obj = class_service.get(id=class_id)
        if not class_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Class with ID {class_id} not found"
            )
        return class_service.update(id=class_id, obj_in=class_in)
    except BusinessLogicError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/classes/{class_id}", response_model=Class)
def delete_class(
    *,
    class_service: ClassService = Depends(),
    class_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Delete a class (admin only)."""
    class_obj = class_service.get(id=class_id)
    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class with ID {class_id} not found"
        )
    return class_service.delete(id=class_id)
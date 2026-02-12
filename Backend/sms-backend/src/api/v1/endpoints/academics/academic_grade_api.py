from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from src.services.academics.academic_grade_service import AcademicGradeService, SuperAdminAcademicGradeService
from src.db.session import get_db
from src.schemas.academics.academic_grade import AcademicGrade, AcademicGradeCreate, AcademicGradeUpdate
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

# Academic Grade endpoints
@router.post("/academic-grades", response_model=AcademicGrade, status_code=status.HTTP_201_CREATED)
async def create_academic_grade(
    *,
    grade_service: AcademicGradeService = Depends(),
    grade_in: AcademicGradeCreate,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Create a new academic grade (requires admin role)."""
    try:
        return await grade_service.create(obj_in=grade_in)
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

@router.get("/academic-grades", response_model=List[AcademicGrade])
async def get_academic_grades(
    *,
    grade_service: AcademicGradeService = Depends(),
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get all academic grades for a tenant with optional filtering (requires authentication)."""
    if is_active is not None and is_active:
        return await grade_service.get_active_grades(skip=skip, limit=limit)
    else:
        filters = {}
        if is_active is not None:
            filters["is_active"] = is_active
        return await grade_service.list(skip=skip, limit=limit, filters=filters)

@router.get("/academic-grades/{grade_id}", response_model=AcademicGrade)
async def get_academic_grade(
    *,
    grade_service: AcademicGradeService = Depends(),
    grade_id: UUID,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get a specific academic grade by ID."""
    grade_obj = await grade_service.get(id=grade_id)
    if not grade_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Academic grade with ID {grade_id} not found"
        )
    return grade_obj

@router.get("/academic-grades/name/{name}", response_model=AcademicGrade)
async def get_academic_grade_by_name(
    *,
    grade_service: AcademicGradeService = Depends(),
    name: str,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get a specific academic grade by name."""
    grade_obj = await grade_service.get_by_name(name=name)
    if not grade_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Academic grade with name {name} not found"
        )
    return grade_obj

@router.put("/academic-grades/{grade_id}", response_model=AcademicGrade)
async def update_academic_grade(
    *,
    grade_service: AcademicGradeService = Depends(),
    grade_id: UUID,
    grade_in: AcademicGradeUpdate,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Update an academic grade (admin only)."""
    try:
        grade_obj = await grade_service.get(id=grade_id)
        if not grade_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Academic grade with ID {grade_id} not found"
            )
        return await grade_service.update(id=grade_id, obj_in=grade_in)
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

@router.delete("/academic-grades/{grade_id}", response_model=AcademicGrade)
async def delete_academic_grade(
    *,
    grade_service: AcademicGradeService = Depends(),
    grade_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Delete an academic grade (admin only)."""
    grade_obj = await grade_service.get(id=grade_id)
    if not grade_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Academic grade with ID {grade_id} not found"
        )
    try:
        return await grade_service.delete(id=grade_id)
    except IntegrityError as e:
        # Check for specific constraint violations if needed
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete grade: It is referenced by other records (e.g. classes, students). Details: {error_msg}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to delete grade: {str(e)}"
        )
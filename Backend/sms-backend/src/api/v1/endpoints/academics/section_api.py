from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from src.services.academics.section_service import SectionService, SuperAdminSectionService
from src.db.session import get_db
from src.schemas.academics.section import Section, SectionCreate, SectionUpdate
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

# Section endpoints
@router.post("/sections", response_model=Section, status_code=status.HTTP_201_CREATED)
def create_section(
    *,
    section_service: SectionService = Depends(),
    section_in: SectionCreate,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Create a new section (requires admin role)."""
    try:
        return section_service.create(obj_in=section_in)
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

@router.get("/sections", response_model=List[Section])
def get_sections(
    *,
    section_service: SectionService = Depends(),
    skip: int = 0,
    limit: int = 100,
    grade_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get all sections for a tenant with optional filtering (requires authentication)."""
    if is_active is not None and is_active:
        return section_service.get_active_sections(grade_id=grade_id, skip=skip, limit=limit)
    else:
        filters = {}
        if grade_id:
            filters["grade_id"] = grade_id
        if is_active is not None:
            filters["is_active"] = is_active
        return section_service.list(skip=skip, limit=limit, filters=filters)

@router.get("/sections/{section_id}", response_model=Section)
def get_section(
    *,
    section_service: SectionService = Depends(),
    section_id: UUID,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get a specific section by ID."""
    section_obj = section_service.get(id=section_id)
    if not section_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section with ID {section_id} not found"
        )
    return section_obj

@router.get("/sections/by-grade/{grade_id}", response_model=List[Section])
def get_sections_by_grade(
    *,
    section_service: SectionService = Depends(),
    grade_id: UUID,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(has_any_role(["admin", "teacher", "student"]))
) -> Any:
    """Get all active sections for a specific grade."""
    return section_service.get_active_sections(grade_id=grade_id, skip=skip, limit=limit)

@router.put("/sections/{section_id}", response_model=Section)
def update_section(
    *,
    section_service: SectionService = Depends(),
    section_id: UUID,
    section_in: SectionUpdate,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Update a section (admin only)."""
    try:
        section_obj = section_service.get(id=section_id)
        if not section_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Section with ID {section_id} not found"
            )
        return section_service.update(id=section_id, obj_in=section_in)
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

@router.delete("/sections/{section_id}", response_model=Section)
def delete_section(
    *,
    section_service: SectionService = Depends(),
    section_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Delete a section (admin only)."""
    section_obj = section_service.get(id=section_id)
    if not section_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section with ID {section_id} not found"
        )
    return section_service.delete(id=section_id)
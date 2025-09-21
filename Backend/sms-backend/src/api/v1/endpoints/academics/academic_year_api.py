from typing import Any, List, Optional
from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from src.services.academics.academic_year_service import AcademicYearService
from src.schemas.academics.academic_year import AcademicYear, AcademicYearCreate, AcademicYearUpdate
from src.core.auth.dependencies import has_permission, get_current_user
from src.schemas.auth import User
from src.core.exceptions.business import (
    BusinessLogicError,
    EntityNotFoundError,
    DuplicateEntityError,
    BusinessRuleViolationError
)

router = APIRouter()

# CREATE
@router.post("/academic-years", response_model=AcademicYear)
def create_academic_year(
    *,
    academic_year_service: AcademicYearService = Depends(),
    academic_year_in: AcademicYearCreate,
    current_user: User = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Create a new academic year with semester dates."""
    try:
        return academic_year_service.create(obj_in=academic_year_in)
    except DuplicateEntityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except BusinessRuleViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# READ ALL
@router.get("/academic-years", response_model=List[AcademicYear])
def get_academic_years(
    *,
    academic_year_service: AcademicYearService = Depends(),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get all academic years with optional filtering."""
    if is_active is not None:
        if is_active:
            return academic_year_service.get_active_years(skip=skip, limit=limit)
        else:
            # Get all years and filter inactive ones
            all_years = academic_year_service.list(skip=skip, limit=limit)
            return [year for year in all_years if not year.is_active]
    return academic_year_service.list(skip=skip, limit=limit)

# READ BY ID
@router.get("/academic-years/{academic_year_id}", response_model=AcademicYear)
def get_academic_year(
    *,
    academic_year_service: AcademicYearService = Depends(),
    academic_year_id: UUID,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get a specific academic year by ID."""
    academic_year = academic_year_service.get(academic_year_id)
    if not academic_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic year not found"
        )
    return academic_year

# READ CURRENT
@router.get("/academic-years/current", response_model=AcademicYear)
def get_current_academic_year(
    *,
    academic_year_service: AcademicYearService = Depends()
) -> Any:
    """Get the current academic year with semester information."""
    current = academic_year_service.get_current()
    if not current:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No current academic year found"
        )
    return current

# UPDATE
@router.put("/academic-years/{academic_year_id}", response_model=AcademicYear)
def update_academic_year(
    *,
    academic_year_service: AcademicYearService = Depends(),
    academic_year_id: UUID,
    academic_year_in: AcademicYearUpdate,
    current_user: User = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Update an academic year."""
    try:
        academic_year = academic_year_service.get(academic_year_id)
        if not academic_year:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Academic year not found"
            )
        return academic_year_service.update(db_obj=academic_year, obj_in=academic_year_in)
    except DuplicateEntityError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except BusinessRuleViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# DELETE
@router.delete("/academic-years/{academic_year_id}")
def delete_academic_year(
    *,
    academic_year_service: AcademicYearService = Depends(),
    academic_year_id: UUID,
    current_user: User = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Delete an academic year."""
    academic_year = academic_year_service.get(academic_year_id)
    if not academic_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic year not found"
        )
    
    # Check if it's the current year
    if academic_year.is_current:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the current academic year"
        )
    
    academic_year_service.remove(academic_year_id)
    return {"message": "Academic year deleted successfully"}

# SPECIAL OPERATIONS
@router.get("/academic-years/current/semester")
def get_current_semester(
    *,
    academic_year_service: AcademicYearService = Depends()
) -> Any:
    """Get current semester information."""
    current_year = academic_year_service.get_current()
    if not current_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No current academic year found"
        )
    
    current_semester = current_year.get_current_semester()
    return {
        "academic_year": current_year.name,
        "current_semester": current_semester,
        "semester_1_active": current_year.is_semester_active(1),
        "semester_2_active": current_year.is_semester_active(2),
        "semester_1_dates": {
            "start": current_year.semester_1_start,
            "end": current_year.semester_1_end
        },
        "semester_2_dates": {
            "start": current_year.semester_2_start,
            "end": current_year.semester_2_end
        }
    }

@router.put("/academic-years/{academic_year_id}/set-current")
def set_current_academic_year(
    *,
    academic_year_service: AcademicYearService = Depends(),
    academic_year_id: UUID,
    current_user: User = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Set a specific academic year as current."""
    try:
        return academic_year_service.set_current_year(academic_year_id)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic year not found"
        )

@router.put("/academic-years/{academic_year_id}/advance-semester")
def advance_semester(
    *,
    academic_year_service: AcademicYearService = Depends(),
    academic_year_id: UUID,
    current_user: User = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Advance to next semester within the academic year."""
    try:
        return academic_year_service.advance_semester(academic_year_id)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic year not found"
        )
    except BusinessRuleViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
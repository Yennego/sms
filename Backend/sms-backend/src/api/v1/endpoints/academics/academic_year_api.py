from typing import Any, List, Optional
from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.exc import IntegrityError
from src.services.academics.academic_year_service import AcademicYearService
from src.schemas.academics.academic_year import AcademicYear, AcademicYearCreate, AcademicYearUpdate, AcademicYearWithDetails
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
async def create_academic_year(
    *,
    academic_year_service: AcademicYearService = Depends(),
    academic_year_in: AcademicYearCreate,
    current_user: User = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Create a new academic year with semester dates."""
    try:
        return await academic_year_service.create(obj_in=academic_year_in)
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
@router.get("/academic-years", response_model=List[AcademicYearWithDetails])
async def get_academic_years(
    *,
    academic_year_service: AcademicYearService = Depends(),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = Query(None),
    include_archived: bool = Query(False),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get all academic years with optional filtering."""
    if is_active is not None:
        if is_active:
            return await academic_year_service.get_active_years_enriched(skip=skip, limit=limit)
        else:
            # Get all years and filter inactive ones
            all_years = await academic_year_service.list_enriched(skip=skip, limit=limit)
            return [year for year in all_years if not year.is_active]
    
    # Get all years
    all_years = await academic_year_service.list_enriched(skip=skip, limit=limit)
    if not include_archived:
        return [year for year in all_years if not year.is_archived]
    return all_years

# READ CURRENT YEAR
@router.get("/academic-years/current", response_model=AcademicYearWithDetails)
async def get_current_academic_year(
    *,
    academic_year_service: AcademicYearService = Depends()
) -> Any:
    """Get the current academic year with semester information."""
    current = await academic_year_service.get_current_enriched()
    if not current:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No current academic year found"
        )
    return current

# READ BY ID
@router.get("/academic-years/{academic_year_id}", response_model=AcademicYear)
async def get_academic_year(
    *,
    academic_year_service: AcademicYearService = Depends(),
    academic_year_id: UUID,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get a specific academic year by ID."""
    academic_year = await academic_year_service.get(academic_year_id)
    if not academic_year:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic year not found"
        )
    return academic_year

# UPDATE
@router.put("/academic-years/{academic_year_id}", response_model=AcademicYear)
async def update_academic_year(
    *,
    academic_year_service: AcademicYearService = Depends(),
    academic_year_id: UUID,
    academic_year_in: AcademicYearUpdate,
    current_user: User = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Update an academic year."""
    try:
        academic_year = await academic_year_service.get(academic_year_id)
        if not academic_year:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Academic year not found"
            )
        return await academic_year_service.update(db_obj=academic_year, obj_in=academic_year_in)
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
    except IntegrityError as e:
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot update academic year: database constraint violated. Details: {error_msg}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update academic year: {str(e)}"
        )

# DELETE
@router.delete("/academic-years/{academic_year_id}")
async def delete_academic_year(
    *,
    academic_year_service: AcademicYearService = Depends(),
    academic_year_id: UUID,
    current_user: User = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Delete an academic year."""
    academic_year = await academic_year_service.get(academic_year_id)
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
    
    try:
        await academic_year_service.delete(id=academic_year_id)
        return {"message": "Academic year deleted successfully"}
    except IntegrityError as e:
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete academic year: It is referenced by other records (e.g. classes, enrollments). Details: {error_msg}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to delete academic year: {str(e)}"
        )

# SPECIAL OPERATIONS
@router.get("/academic-years/current/semester")
async def get_current_semester(
    *,
    academic_year_service: AcademicYearService = Depends()
) -> Any:
    """Get current semester information."""
    current_year = await academic_year_service.get_current()
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
async def set_current_academic_year(
    *,
    academic_year_service: AcademicYearService = Depends(),
    academic_year_id: UUID,
    current_user: User = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Set a specific academic year as current."""
    try:
        return await academic_year_service.set_current_year(academic_year_id)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic year not found"
        )

@router.put("/academic-years/{academic_year_id}/advance-semester")
async def advance_semester(
    *,
    academic_year_service: AcademicYearService = Depends(),
    academic_year_id: UUID,
    current_user: User = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Advance to next semester within the academic year."""
    try:
        return await academic_year_service.advance_semester(academic_year_id)
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

@router.post("/academic-years/{academic_year_id}/archive")
async def archive_academic_year(
    *,
    academic_year_service: AcademicYearService = Depends(),
    academic_year_id: UUID,
    current_user: User = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Archive an academic year."""
    try:
        return await academic_year_service.archive(academic_year_id)
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
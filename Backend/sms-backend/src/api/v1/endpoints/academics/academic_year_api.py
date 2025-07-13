from typing import Any, List, Optional
from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status, Body
from src.services.academics.academic_year_service import AcademicYearService
from src.schemas.academics.academic_year import AcademicYear, AcademicYearCreate, AcademicYearUpdate
from src.core.auth.dependencies import has_permission, get_current_user
from src.schemas.auth import User

router = APIRouter()

@router.post("/academic-years", response_model=AcademicYear)
@has_permission("manage_academic_year")
def create_academic_year(
    *,
    academic_year_service: AcademicYearService = Depends(),
    academic_year_in: AcademicYearCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Create a new academic year with semester dates."""
    return academic_year_service.create(obj_in=academic_year_in)

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

@router.put("/academic-years/{academic_year_id}/advance-semester")
@has_permission("manage_academic_year")
def advance_semester(
    *,
    academic_year_service: AcademicYearService = Depends(),
    academic_year_id: UUID,
    current_user: User = Depends(get_current_user)
) -> Any:
    """Advance to next semester within the academic year."""
    return academic_year_service.advance_semester(academic_year_id)
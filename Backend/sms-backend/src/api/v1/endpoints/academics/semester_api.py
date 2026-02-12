from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from src.services.academics.semester_service import SemesterService
from src.schemas.academics.semester import Semester, SemesterCreate, SemesterUpdate
from src.core.auth.dependencies import has_permission

router = APIRouter()

@router.get("/semesters", response_model=List[Semester])
async def get_semesters(
    academic_year_id: UUID,
    semester_service: SemesterService = Depends()
) -> Any:
    """Get all semesters for an academic year."""
    return await semester_service.get_by_academic_year(academic_year_id)

@router.get("/semesters/{semester_id}", response_model=Semester)
async def get_semester(
    semester_id: UUID,
    semester_service: SemesterService = Depends()
) -> Any:
    """Get a specific semester."""
    semester = await semester_service.get(semester_id)
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    return semester

@router.post("/semesters", response_model=Semester)
async def create_semester(
    semester_in: SemesterCreate,
    semester_service: SemesterService = Depends(),
    current_user = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Create a new semester."""
    return await semester_service.create(obj_in=semester_in)

@router.put("/semesters/{semester_id}", response_model=Semester)
async def update_semester(
    semester_id: UUID,
    semester_in: SemesterUpdate,
    semester_service: SemesterService = Depends(),
    current_user = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Update a semester."""
    return await semester_service.update(id=semester_id, obj_in=semester_in)

@router.delete("/semesters/{semester_id}")
async def delete_semester(
    semester_id: UUID,
    semester_service: SemesterService = Depends(),
    current_user = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Delete a semester."""
    await semester_service.delete(id=semester_id)
    return {"message": "Semester deleted successfully"}

@router.post("/semesters/{semester_id}/toggle-published", response_model=Semester)
async def toggle_semester_published(
    semester_id: UUID,
    semester_service: SemesterService = Depends(),
    current_user = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Toggle the global publication status for a semester."""
    return await semester_service.toggle_publication(semester_id)

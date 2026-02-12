from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from src.services.academics.period_service import PeriodService
from src.schemas.academics.period import Period, PeriodCreate, PeriodUpdate
from src.core.auth.dependencies import has_permission

router = APIRouter()

@router.get("/periods", response_model=List[Period])
async def get_periods(
    semester_id: UUID,
    period_service: PeriodService = Depends()
) -> Any:
    """Get all periods for a semester."""
    return await period_service.get_by_semester(semester_id)

@router.get("/periods/{period_id}", response_model=Period)
async def get_period(
    period_id: UUID,
    period_service: PeriodService = Depends()
) -> Any:
    """Get a specific period."""
    period = await period_service.get(period_id)
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    return period

@router.post("/periods", response_model=Period)
async def create_period(
    period_in: PeriodCreate,
    period_service: PeriodService = Depends(),
    current_user = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Create a new period."""
    return await period_service.create(obj_in=period_in)

@router.put("/periods/{period_id}", response_model=Period)
async def update_period(
    period_id: UUID,
    period_in: PeriodUpdate,
    period_service: PeriodService = Depends(),
    current_user = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Update a period."""
    return await period_service.update(id=period_id, obj_in=period_in)

@router.delete("/periods/{period_id}")
async def delete_period(
    period_id: UUID,
    period_service: PeriodService = Depends(),
    current_user = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Delete a period."""
    await period_service.delete(id=period_id)
    return {"message": "Period deleted successfully"}

@router.post("/periods/{period_id}/toggle-published", response_model=Period)
async def toggle_period_published(
    period_id: UUID,
    period_service: PeriodService = Depends(),
    current_user = Depends(has_permission("manage_academic_year"))
) -> Any:
    """Toggle the global publication status for a period."""
    return await period_service.toggle_publication(period_id)

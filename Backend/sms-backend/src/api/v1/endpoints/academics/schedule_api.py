from typing import Any, List, Optional
from uuid import UUID
from datetime import time

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from src.services.academics.schedule_service import ScheduleService, SuperAdminScheduleService
from src.db.session import get_db
from src.schemas.academics.schedule import Schedule, ScheduleCreate, ScheduleUpdate, ScheduleWithDetails
from src.db.models.academics.schedule import DayOfWeek
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

# Schedule endpoints
@router.post("/schedules", response_model=Schedule, status_code=status.HTTP_201_CREATED)
def create_schedule(
    *,
    schedule_service: ScheduleService = Depends(),
    schedule_in: ScheduleCreate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Create a new schedule (requires admin or teacher role)."""
    try:
        return schedule_service.create(obj_in=schedule_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/schedules", response_model=List[Schedule])
def get_schedules(
    *,
    schedule_service: ScheduleService = Depends(),
    skip: int = 0,
    limit: int = 100,
    class_id: Optional[UUID] = None,
    day_of_week: Optional[str] = None,
    period: Optional[int] = None
) -> Any:
    """Get all schedules for a tenant with optional filtering."""
    filters = {}
    if class_id:
        filters["class_id"] = class_id
    if day_of_week:
        try:
            day_enum = DayOfWeek(day_of_week.lower())
            filters["day_of_week"] = day_enum
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid day of week: {day_of_week}"
            )
    if period is not None:
        filters["period"] = period
    
    return schedule_service.list(skip=skip, limit=limit, filters=filters)

@router.get("/schedules/{schedule_id}", response_model=Schedule)
def get_schedule(
    *,
    schedule_service: ScheduleService = Depends(),
    schedule_id: UUID
) -> Any:
    """Get a specific schedule by ID."""
    schedule = schedule_service.get(id=schedule_id)
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule with ID {schedule_id} not found"
        )
    return schedule

@router.put("/schedules/{schedule_id}", response_model=Schedule)
def update_schedule(
    *,
    schedule_service: ScheduleService = Depends(),
    schedule_id: UUID,
    schedule_in: ScheduleUpdate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Update a schedule."""
    try:
        schedule = schedule_service.get(id=schedule_id)
        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule with ID {schedule_id} not found"
            )
        return schedule_service.update(id=schedule_id, obj_in=schedule_in)
    except BusinessLogicError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/schedules/{schedule_id}", response_model=Schedule)
def delete_schedule(
    *,
    schedule_service: ScheduleService = Depends(),
    schedule_id: UUID,
    current_user: User = Depends(has_any_role(["admin"]))
) -> Any:
    """Delete a schedule (admin only)."""
    schedule = schedule_service.get(id=schedule_id)
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule with ID {schedule_id} not found"
        )
    return schedule_service.delete(id=schedule_id)
from typing import Any, List, Optional, Dict
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, Path
from sqlalchemy.orm import Session

from src.services.communication.event_service import EventService, SuperAdminEventService
from src.db.session import get_db
from src.schemas.communication.event import Event, EventCreate, EventUpdate, EventWithDetails
from src.core.middleware.tenant import get_tenant_from_request
from src.core.auth.dependencies import has_any_role, get_current_user, has_permission
from src.schemas.auth import User
from src.core.exceptions.business import EntityNotFoundError

router = APIRouter()

# User event endpoints
@router.get("/events", response_model=List[Event])
def get_events(
    *,
    event_service: EventService = Depends(),
    current_user: User = Depends(get_current_user),
    active_only: bool = Query(True, description="Filter to show only active events"),
    organizer_id: Optional[UUID] = Query(None, description="Filter by organizer ID"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    upcoming_only: bool = Query(False, description="Filter to show only upcoming events"),
    limit: int = Query(100, description="Limit the number of results")
) -> Any:
    """Get events with optional filtering."""
    try:
        if upcoming_only:
            return event_service.get_upcoming_events(limit=limit)
        elif organizer_id:
            return event_service.get_events_by_organizer(organizer_id=organizer_id)
        elif event_type:
            return event_service.get_events_by_type(event_type=event_type)
        elif start_date and end_date:
            return event_service.get_events_by_date_range(start_date=start_date, end_date=end_date)
        elif active_only:
            return event_service.get_active_events()
        else:
            # Default to all events
            return event_service.list(skip=0, limit=limit)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/events/{event_id}", response_model=EventWithDetails)
def get_event(
    *,
    event_service: EventService = Depends(),
    event_id: UUID = Path(..., description="The ID of the event to get"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get a specific event with details."""
    try:
        event = event_service.get_event_with_details(id=event_id)
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )
        return event
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

# Admin event endpoints
@router.post("/events", response_model=Event, status_code=status.HTTP_201_CREATED)
def create_event(
    *,
    event_service: EventService = Depends(),
    event_in: EventCreate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Create a new event (admin or teacher only)."""
    try:
        # Set the organizer to the current user if not specified
        if not event_in.organizer_id:
            event_in.organizer_id = current_user.id
        
        return event_service.create(obj_in=event_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.put("/events/{event_id}", response_model=Event)
def update_event(
    *,
    event_service: EventService = Depends(),
    event_id: UUID = Path(..., description="The ID of the event to update"),
    event_in: EventUpdate,
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Update an event (admin or teacher only)."""
    try:
        event = event_service.get(id=event_id)
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )
        
        # Check if the current user is the organizer or an admin
        if str(event.organizer_id) != str(current_user.id) and "admin" not in current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update this event"
            )
        
        return event_service.update(id=event_id, obj_in=event_in)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.delete("/events/{event_id}", response_model=Event)
def delete_event(
    *,
    event_service: EventService = Depends(),
    event_id: UUID = Path(..., description="The ID of the event to delete"),
    current_user: User = Depends(has_any_role(["admin", "teacher"]))
) -> Any:
    """Delete an event (admin or teacher only)."""
    try:
        event = event_service.get(id=event_id)
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )
        
        # Check if the current user is the organizer or an admin
        if str(event.organizer_id) != str(current_user.id) and "admin" not in current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this event"
            )
        
        return event_service.delete(id=event_id)
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

# Super Admin endpoints
@router.get("/super-admin/events", response_model=List[Event])
def get_all_events(
    *,
    event_service: SuperAdminEventService = Depends(),
    skip: int = 0,
    limit: int = 100,
    organizer_id: Optional[UUID] = None,
    event_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(has_permission("view_all_events"))
) -> Any:
    """Get all events across all tenants with filtering (super-admin only)."""
    try:
        return event_service.get_all_events(
            skip=skip,
            limit=limit,
            organizer_id=organizer_id,
            event_type=event_type,
            is_active=is_active,
            start_date=start_date,
            end_date=end_date,
            tenant_id=tenant_id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
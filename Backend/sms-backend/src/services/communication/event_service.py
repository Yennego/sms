from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from datetime import datetime

from src.db.crud.communication import event_crud
from src.db.models.communication.event import Event, EventType
from src.schemas.communication.event import EventCreate, EventUpdate, EventWithDetails
from src.services.base.base import TenantBaseService, SuperAdminBaseService
# from src.core.exceptions.business import EntityNotFoundError


class EventService(TenantBaseService[Event, EventCreate, EventUpdate]):
    """Service for managing events within a tenant."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=event_crud, model=Event, *args, **kwargs)
    
    def get_active_events(self) -> List[Event]:
        """Get all active events."""
        return event_crud.get_active_events(
            self.db, tenant_id=self.tenant_id
        )
    
    def get_events_by_organizer(self, organizer_id: UUID) -> List[Event]:
        """Get all events by a specific organizer."""
        return event_crud.get_events_by_organizer(
            self.db, tenant_id=self.tenant_id, organizer_id=organizer_id
        )
    
    def get_events_by_type(self, event_type: str) -> List[Event]:
        """Get all events of a specific type."""
        try:
            type_enum = EventType(event_type)
            return event_crud.get_events_by_type(
                self.db, tenant_id=self.tenant_id, event_type=type_enum
            )
        except ValueError:
            raise ValueError(f"Invalid event type: {event_type}")
    
    def get_events_by_date_range(self, start_date: datetime, end_date: datetime) -> List[Event]:
        """Get all events within a specific date range."""
        return event_crud.get_events_by_date_range(
            self.db, tenant_id=self.tenant_id, start_date=start_date, end_date=end_date
        )
    
    def get_upcoming_events(self, limit: int = 10) -> List[Event]:
        """Get upcoming events."""
        return event_crud.get_upcoming_events(
            self.db, tenant_id=self.tenant_id, limit=limit
        )
    
    def get_event_with_details(self, id: UUID) -> Optional[EventWithDetails]:
        """Get an event with additional details like organizer name."""
        event = self.get(id=id)
        if not event:
            return None
        
        # Get organizer name
        organizer = self.db.query("User").filter("User.id" == event.organizer_id).first()
        organizer_name = f"{organizer.first_name} {organizer.last_name}" if organizer else "Unknown"
        
        # Create EventWithDetails
        event_dict = event.__dict__.copy()
        event_dict["organizer_name"] = organizer_name
        
        return EventWithDetails(**event_dict)


class SuperAdminEventService(SuperAdminBaseService[Event, EventCreate, EventUpdate]):
    """Super-admin service for managing events across all tenants."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=event_crud, model=Event, *args, **kwargs)
    
    def get_all_events(self, skip: int = 0, limit: int = 100,
                      organizer_id: Optional[UUID] = None,
                      event_type: Optional[str] = None,
                      is_active: Optional[bool] = None,
                      start_date: Optional[datetime] = None,
                      end_date: Optional[datetime] = None,
                      tenant_id: Optional[UUID] = None) -> List[Event]:
        """Get all events across all tenants with filtering."""
        query = self.db.query(Event)
        
        # Apply filters
        if organizer_id:
            query = query.filter(Event.organizer_id == organizer_id)
        if event_type:
            try:
                type_enum = EventType(event_type)
                query = query.filter(Event.event_type == type_enum)
            except ValueError:
                raise ValueError(f"Invalid event type: {event_type}")
        if is_active is not None:
            query = query.filter(Event.is_active == is_active)
        if start_date:
            query = query.filter(Event.start_datetime >= start_date)
        if end_date:
            query = query.filter(Event.start_datetime <= end_date)
        if tenant_id:
            query = query.filter(Event.tenant_id == tenant_id)
        
        # Apply pagination and ordering
        return query.order_by(Event.start_datetime).offset(skip).limit(limit).all()
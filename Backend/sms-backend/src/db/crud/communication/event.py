from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_

from src.db.crud.base.base import TenantCRUDBase
from src.db.models.communication.event import Event, EventType
from src.schemas.communication.event import EventCreate, EventUpdate


class CRUDEvent(TenantCRUDBase[Event, EventCreate, EventUpdate]):
    """CRUD operations for Event model."""
    
    def get_active_events(self, db: Session, tenant_id: Any) -> List[Event]:
        """Get all active events within a tenant."""
        return db.query(Event).filter(
            Event.tenant_id == tenant_id,
            Event.is_active == True
        ).order_by(Event.start_datetime).all()
    
    def get_events_by_organizer(self, db: Session, tenant_id: Any, organizer_id: Any) -> List[Event]:
        """Get all events by a specific organizer within a tenant."""
        return db.query(Event).filter(
            Event.tenant_id == tenant_id,
            Event.organizer_id == organizer_id
        ).order_by(Event.start_datetime).all()
    
    def get_events_by_type(self, db: Session, tenant_id: Any, event_type: EventType) -> List[Event]:
        """Get all events of a specific type within a tenant."""
        return db.query(Event).filter(
            Event.tenant_id == tenant_id,
            Event.event_type == event_type
        ).order_by(Event.start_datetime).all()
    
    def get_events_by_date_range(self, db: Session, tenant_id: Any, start_date: datetime, end_date: datetime) -> List[Event]:
        """Get all events within a specific date range within a tenant."""
        return db.query(Event).filter(
            Event.tenant_id == tenant_id,
            and_(
                Event.start_datetime >= start_date,
                Event.start_datetime <= end_date
            )
        ).order_by(Event.start_datetime).all()
    
    def get_upcoming_events(self, db: Session, tenant_id: Any, limit: int = 10) -> List[Event]:
        """Get upcoming events within a tenant."""
        now = datetime.now()
        return db.query(Event).filter(
            Event.tenant_id == tenant_id,
            Event.start_datetime >= now,
            Event.is_active == True
        ).order_by(Event.start_datetime).limit(limit).all()


event_crud = CRUDEvent(Event)
from typing import Any, Dict, List, Optional, Union
from uuid import UUID
from sqlalchemy.orm import Session

from src.db.crud.base import TenantCRUDBase
from src.db.models.academics.schedule import Schedule, DayOfWeek
from src.schemas.academics.schedule import ScheduleCreate, ScheduleUpdate


class CRUDSchedule(TenantCRUDBase[Schedule, ScheduleCreate, ScheduleUpdate]):
    """CRUD operations for Schedule model."""
    
    def get_by_class(self, db: Session, tenant_id: Any, class_id: UUID) -> List[Schedule]:
        """Get schedules by class within a tenant."""
        return db.query(Schedule).filter(
            Schedule.tenant_id == tenant_id,
            Schedule.class_id == class_id
        ).all()
    
    def get_by_day(self, db: Session, tenant_id: Any, day_of_week: DayOfWeek) -> List[Schedule]:
        """Get schedules by day of week within a tenant."""
        return db.query(Schedule).filter(
            Schedule.tenant_id == tenant_id,
            Schedule.day_of_week == day_of_week
        ).all()
    
    def get_by_period(self, db: Session, tenant_id: Any, period: int) -> List[Schedule]:
        """Get schedules by period within a tenant."""
        return db.query(Schedule).filter(
            Schedule.tenant_id == tenant_id,
            Schedule.period == period
        ).all()
    
    def get_by_time_range(self, db: Session, tenant_id: Any, start_time, end_time) -> List[Schedule]:
        """Get schedules by time range within a tenant."""
        return db.query(Schedule).filter(
            Schedule.tenant_id == tenant_id,
            Schedule.start_time >= start_time,
            Schedule.end_time <= end_time
        ).all()


schedule_crud = CRUDSchedule(Schedule)


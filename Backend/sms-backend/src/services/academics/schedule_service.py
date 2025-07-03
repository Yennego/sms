from typing import List, Optional, Dict, Any
from uuid import UUID

from src.db.crud.academics import schedule_crud
from src.db.models.academics.schedule import Schedule, DayOfWeek
from src.schemas.academics.schedule import ScheduleCreate, ScheduleUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import EntityNotFoundError


class ScheduleService(TenantBaseService[Schedule, ScheduleCreate, ScheduleUpdate]):
    """Service for managing schedules within a tenant."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=schedule_crud, model=Schedule, *args, **kwargs)
    
    def get_by_class(self, class_id: UUID) -> List[Schedule]:
        """Get schedules by class."""
        return schedule_crud.get_by_class(self.db, tenant_id=self.tenant_id, class_id=class_id)
    
    def get_by_day(self, day_of_week: DayOfWeek) -> List[Schedule]:
        """Get schedules by day of week."""
        return schedule_crud.get_by_day(self.db, tenant_id=self.tenant_id, day_of_week=day_of_week)
    
    def get_by_period(self, period: int) -> List[Schedule]:
        """Get schedules by period."""
        return schedule_crud.get_by_period(self.db, tenant_id=self.tenant_id, period=period)
    
    def get_by_time_range(self, start_time, end_time) -> List[Schedule]:
        """Get schedules by time range."""
        return schedule_crud.get_by_time_range(
            self.db, tenant_id=self.tenant_id, start_time=start_time, end_time=end_time
        )


class SuperAdminScheduleService(SuperAdminBaseService[Schedule, ScheduleCreate, ScheduleUpdate]):
    """Super-admin service for managing schedules across all tenants."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=schedule_crud, model=Schedule, *args, **kwargs)
    
    def get_all_schedules(self, skip: int = 0, limit: int = 100,
                         day_of_week: Optional[DayOfWeek] = None,
                         tenant_id: Optional[UUID] = None) -> List[Schedule]:
        """Get all schedules across all tenants with filtering."""
        query = self.db.query(Schedule)
        
        # Apply filters
        if day_of_week:
            query = query.filter(Schedule.day_of_week == day_of_week)
        if tenant_id:
            query = query.filter(Schedule.tenant_id == tenant_id)
        
        return query.offset(skip).limit(limit).all()


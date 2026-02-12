from typing import List, Optional, Any
from uuid import UUID
from fastapi import Depends
from sqlalchemy.orm import Session
from src.db.crud.academics.period_crud import period_crud
from src.db.models.academics.period import Period
from src.schemas.academics.period import PeriodCreate, PeriodUpdate
from src.services.base.base import TenantBaseService
from src.db.session import get_db
from src.core.middleware.tenant import get_tenant_from_request

class PeriodService(TenantBaseService[Period, PeriodCreate, PeriodUpdate]):
    """Service for managing academic periods."""
    
    def __init__(
        self,
        tenant: Any = Depends(get_tenant_from_request),
        db: Session = Depends(get_db)
    ):
        tenant_id = tenant.id if hasattr(tenant, 'id') else tenant
        super().__init__(crud=period_crud, model=Period, tenant_id=tenant_id, db=db)
    
    async def get_by_semester(self, semester_id: UUID) -> List[Period]:
        """Get all periods for a semester."""
        return period_crud.get_by_semester(self.db, self.tenant_id, semester_id)
    
    async def toggle_publication(self, period_id: UUID) -> Period:
        """Toggle the global publication flag for a period."""
        period = await self.get(period_id)
        if not period:
            from src.core.exceptions.business import EntityNotFoundError
            raise EntityNotFoundError("Period", period_id)
        
        period.is_published = not period.is_published
        self.db.commit()
        self.db.refresh(period)
        return period

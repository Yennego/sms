from typing import List, Any
from sqlalchemy.orm import Session
from src.db.crud.base import TenantCRUDBase
from src.db.models.academics.period import Period
from src.schemas.academics.period import PeriodCreate, PeriodUpdate

class CRUDPeriod(TenantCRUDBase[Period, PeriodCreate, PeriodUpdate]):
    """CRUD operations for Period model."""
    
    def get_by_semester(self, db: Session, tenant_id: Any, semester_id: Any) -> List[Period]:
        """Get all periods for a specific semester."""
        return db.query(Period).filter(
            Period.tenant_id == tenant_id,
            Period.semester_id == semester_id
        ).order_by(Period.period_number).all()

period_crud = CRUDPeriod(Period)

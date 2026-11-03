from typing import Any

from sqlalchemy.orm import Session

from src.db.crud.base import TenantCRUDBase
from src.db.models.finance.expenditure import Expenditure
from src.schemas.finance.expenditure import ExpenditureCreate, ExpenditureUpdate

class CRUDExpenditure(TenantCRUDBase[Expenditure, ExpenditureCreate, ExpenditureUpdate]):
    def create(self, db: Session, tenant_id: Any, *, obj_in: ExpenditureCreate) -> Expenditure:
        """Keeps the amount a Decimal (the base class's JSON encoding would make it a float)."""
        db_obj = Expenditure(**obj_in.model_dump(), tenant_id=self._ensure_uuid(tenant_id))
        db.add(db_obj)
        db.flush()  # committed once per request (get_db)
        db.refresh(db_obj)
        return db_obj

expenditure = CRUDExpenditure(Expenditure)

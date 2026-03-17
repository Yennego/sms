from src.db.crud.base import TenantCRUDBase
from src.db.models.finance.expenditure import Expenditure
from src.schemas.finance.expenditure import ExpenditureCreate, ExpenditureUpdate

class CRUDExpenditure(TenantCRUDBase[Expenditure, ExpenditureCreate, ExpenditureUpdate]):
    pass

expenditure = CRUDExpenditure(Expenditure)

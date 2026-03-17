from src.db.crud.base import TenantCRUDBase
from src.db.models.finance.fee_category import FeeCategory
from src.schemas.finance.fee_category import FeeCategoryCreate, FeeCategoryUpdate

class CRUDFeeCategory(TenantCRUDBase[FeeCategory, FeeCategoryCreate, FeeCategoryUpdate]):
    pass

fee_category = CRUDFeeCategory(FeeCategory)

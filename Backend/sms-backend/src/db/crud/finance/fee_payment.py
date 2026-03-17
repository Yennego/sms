from src.db.crud.base import TenantCRUDBase
from src.db.models.finance.fee_payment import FeePayment
from src.schemas.finance.fee_payment import FeePaymentCreate, FeePaymentUpdate

class CRUDFeePayment(TenantCRUDBase[FeePayment, FeePaymentCreate, FeePaymentUpdate]):
    pass

fee_payment = CRUDFeePayment(FeePayment)

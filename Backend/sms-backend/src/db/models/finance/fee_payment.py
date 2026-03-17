from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from src.db.models.base import TenantModel

class FeePayment(TenantModel):
    """Model acting as a receipt or ledger entry, recording actual payment against a StudentFee."""
    
    __tablename__ = "fee_payments"
    
    student_fee_id = Column(UUID(as_uuid=True), ForeignKey("student_fees.id"), nullable=False)
    amount_paid = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(String(50), nullable=False) # CASH, BANK_TRANSFER, STRIPE, etc.
    payment_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reference_id = Column(String(100), nullable=True) # Cheque number, internal ref, etc.
    
    student_fee = relationship("StudentFee", back_populates="payments")
    
    def __repr__(self):
        return f"<FeePayment amount={self.amount_paid} method={self.payment_method}>"

from sqlalchemy import Column, String, Numeric, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.db.models.base import TenantModel

class FeeInstallment(TenantModel):
    """Model breaking down a StudentFee into scheduled installment blocks."""
    
    __tablename__ = "fee_installments"
    
    student_fee_id = Column(UUID(as_uuid=True), ForeignKey("student_fees.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    due_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="PENDING") # PENDING, PAID, OVERDUE
    
    student_fee = relationship("StudentFee", back_populates="installments")
    
    def __repr__(self):
        return f"<FeeInstallment amount={self.amount} status={self.status}>"

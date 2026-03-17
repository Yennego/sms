from sqlalchemy import Column, String, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.db.models.base import TenantModel

class StudentFee(TenantModel):
    """Model assigning a specific FeeStructure to a Student, tracking their payment progress."""
    
    __tablename__ = "student_fees"
    
    fee_structure_id = Column(UUID(as_uuid=True), ForeignKey("fee_structures.id"), nullable=False)
    # student_id links directly to the student's id which is actually a ForeignKey to users.id
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    total_amount = Column(Numeric(10, 2), nullable=False)
    amount_paid = Column(Numeric(10, 2), nullable=False, default=0.0)
    balance = Column(Numeric(10, 2), nullable=False)
    status = Column(String(20), nullable=False, default="PENDING") # PENDING, PARTIAL, PAID, OVERDUE
    
    fee_structure = relationship("FeeStructure", back_populates="student_fees")
    student = relationship("Student", foreign_keys=[student_id], backref="fees")
    installments = relationship("FeeInstallment", back_populates="student_fee", cascade="all, delete-orphan")
    payments = relationship("FeePayment", back_populates="student_fee", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<StudentFee status={self.status} balance={self.balance}>"

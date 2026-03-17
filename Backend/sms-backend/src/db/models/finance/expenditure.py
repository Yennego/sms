from sqlalchemy import Column, String, Numeric, Date, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.db.models.base import TenantModel

class Expenditure(TenantModel):
    """Model representing an outgoing payment made by the school."""
    
    __tablename__ = "expenditures"
    
    expense_category_id = Column(UUID(as_uuid=True), ForeignKey("expense_categories.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    date = Column(Date, nullable=False)
    payee = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    
    category = relationship("ExpenseCategory", back_populates="expenditures")
    
    def __repr__(self):
        return f"<Expenditure {self.amount} to {self.payee}>"

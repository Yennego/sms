from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship
from src.db.models.base import TenantModel

class ExpenseCategory(TenantModel):
    """Model categorizing outgoing school expenses (e.g., Salary, Maintenance)."""
    
    __tablename__ = "expense_categories"
    
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    expenditures = relationship("Expenditure", back_populates="category", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<ExpenseCategory {self.name}>"

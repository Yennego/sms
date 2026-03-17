from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship
from src.db.models.base import TenantModel

class FeeCategory(TenantModel):
    """Model representing a type of fee (e.g., Tuition, Transport, Library)."""
    
    __tablename__ = "fee_categories"
    
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    fee_structures = relationship("FeeStructure", back_populates="category", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<FeeCategory {self.name}>"

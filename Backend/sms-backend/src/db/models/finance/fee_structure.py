from sqlalchemy import Column, Numeric, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.db.models.base import TenantModel

class FeeStructure(TenantModel):
    """Model defining the cost and due date of a specific fee category for a given class and academic year."""
    
    __tablename__ = "fee_structures"
    
    category_id = Column(UUID(as_uuid=True), ForeignKey("fee_categories.id"), nullable=False)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    # grade_id is optional, if None, it applies to all grades (institutional fee)
    grade_id = Column(UUID(as_uuid=True), ForeignKey("academic_grades.id"), nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    due_date = Column(Date, nullable=False)
    
    category = relationship("FeeCategory", back_populates="fee_structures")
    grade = relationship("AcademicGrade")
    student_fees = relationship("StudentFee", back_populates="fee_structure", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<FeeStructure {self.amount} for category_id {self.category_id}>"

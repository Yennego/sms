from sqlalchemy import Column, String, Boolean
from sqlalchemy.orm import relationship
from src.db.models.base import TenantModel

class Parent(TenantModel):
    __tablename__ = "parent"

    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)

    # Relationships
    students = relationship("Student", back_populates="parent")

    def __repr__(self) -> str:
        return f"<Parent {self.email}>" 
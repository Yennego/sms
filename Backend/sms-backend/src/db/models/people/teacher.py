from uuid import UUID
from sqlalchemy import Column, String, Date, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from src.db.models.auth.user import User
from datetime import date
from sqlalchemy.dialects.postgresql import UUID

class Teacher(User):
    """Model representing a teacher in the system."""
    
    __tablename__ = "teachers"
    
    # Link to parent table
    id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    
    # Teacher-specific fields
    employee_id = Column(String(50), nullable=False, unique=True)
    department = Column(String(100), nullable=True)
    qualification = Column(String(200), nullable=True)
    joining_date = Column(Date, nullable=True)
    is_class_teacher = Column(Boolean, default=False)

    # Override address column from User model to avoid conflicts
    address = Column('teacher_address', String(255), nullable=True)
    city = Column(String(50), nullable=True)
    county = Column(String(50), nullable=True)
    country = Column(String(50), nullable=True)
    gender = Column(String(10), nullable=True)
    whatsapp_number = Column(String(20), nullable=True)
   
    # status
    status = Column(
        String(20),
        nullable=False,
        default="active",
        comment="One of: active, inactive, retired, resigned"
    )
    exit_date          = Column(Date, nullable=True)
    retirement_date            = Column(Date, nullable=True)
    resignation_date           = Column(Date, nullable=True)
    resignation_reason = Column(String(255), nullable=True)
    
    __mapper_args__ = {
        "polymorphic_identity": "teacher",
    }

    def is_teacher_active(self) -> bool:
        return self.status == "active"

    def retire(self, date_left: date):
        """
        Mark the teacher as retired.
        """
        self.status = "retired"
        self.exit_date = date_left
        self.retirement_date = date_left

    def resign(self, date_left: date, reason: str = None):
        """
        Mark the teacher as resigned, storing a reason.
        """
        self.status = "resigned"
        self.exit_date = date_left
        self.resignation_date = date_left
        self.resignation_reason = reason

    def deactivate(self, date_left: date = None, reason: str = None):
        """
        Mark the teacher as inactive.
        """
        self.status = "inactive"
        if date_left:
            self.exit_date = date_left
        self.resignation_reason = reason

    def activate(self):
        """
        Reactivate the teacher.
        """
        self.status = "active"
        self.exit_date = None
        self.resignation_reason = None

    
    # Relationships
    grades = relationship("Grade", back_populates="teacher", foreign_keys="[Grade.graded_by]")
    
    def __repr__(self):
        return f"<Teacher {self.email} - {self.employee_id}>"

        
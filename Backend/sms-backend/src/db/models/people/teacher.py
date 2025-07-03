from uuid import UUID
from sqlalchemy import Column, String, Date, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from src.db.models.auth.user import User
from datetime import date
from sqlalchemy.dialects.postgresql import UUID

class Teacher(User):
    """Model representing a teacher in the system.
    
    Teachers are users with additional teacher-specific attributes.
    This class extends the base User class with teacher-specific attributes.
    
    Attributes:
        employee_id (str): Unique employee ID for the teacher
        department (str): Department the teacher belongs to
        qualification (str): Educational qualification
        joining_date (Date): Date when the teacher joined
        is_class_teacher (bool): Whether the teacher is a class teacher
    """
    
    __tablename__ = "teachers"
    
    # Link to parent table
    id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    
    # Teacher-specific fields
    employee_id = Column(String(50), nullable=False, unique=True)
    department = Column(String(100), nullable=True)
    qualification = Column(String(200), nullable=True)
    joining_date = Column(Date, nullable=True)
    is_class_teacher = Column(Boolean, default=False)

    # personal info
    address = Column(String(255), nullable=True)
    city = Column(String(50), nullable=True)
    county = Column(String(50), nullable=True)
    country = Column(String(50), nullable=True)
    gender = Column(String(10), nullable=True)
    whatsapp_number = Column(String(20), nullable=True) #e.g +231 777 123 4567
   
    # status
    status = Column(
        String(20),
        nullable=False,
        default="active",
        comment="One of: active, retired, resigned"
    )
    exit_date          = Column(Date, nullable=True)
    retirement_date            = Column(Date, nullable=True)
    resignation_date           = Column(Date, nullable=True)
    resignation_reason = Column(String(255), nullable=True)
    
    __mapper_args__ = {
        "polymorphic_identity": "teacher",
    }

    def is_active(self) -> bool:
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

    
    # Relationships
    # This will be defined when we implement class, subject and other academic models
    
    def __repr__(self):
        return f"<Teacher {self.email} - {self.employee_id}>"

        
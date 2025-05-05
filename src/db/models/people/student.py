from sqlalchemy import Column, String, Date, ForeignKey, Integer
from sqlalchemy.orm import relationship
from src.db.models.auth.user import User
from datetime import date
# from uuid import UUID
from sqlalchemy.dialects.postgresql import UUID

class Student(User):
    """Model representing a student in the system.
    
    Students are users with additional student-specific attributes.
    This class extends the base User class with student-specific attributes.
    
    Attributes:
        admission_number (str): Unique admission number for the student
        grade (str): Current grade/class of the student
        section (str): Section within the grade
        admission_date (Date): Date when the student was admitted
        roll_number (int): Roll number in the class
    """
    
    __tablename__ = "students"
    
    # Link to parent table
    id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    
    
    # Student-specific fields
    # academic info
    admission_number = Column(String(50), nullable=False, unique=True)
    roll_number = Column(Integer, nullable=True) #e.g 1
    grade = Column(String(20), nullable=True) #e.g 10
    section = Column(String(10), nullable=True) #e.g A
    admission_date = Column(Date, nullable=True) #e.g 2020-01-01

    # Personal info
    date_of_birth = Column(Date, nullable=True) #e.g 2000-01-01
    gender = Column(String(10), nullable=True) #e.g Male
    blood_group = Column(String(5), nullable=True) #e.g A+
    nationality = Column(String(50), nullable=True) #e.g Liberian
    religion = Column(String(50), nullable=True) #e.g Christianity

    # contact info
    address = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)  #e.g Paynesville
    County = Column(String(100), nullable=True) #e.g Lofa
    country = Column(String(100), nullable=True) #e.g Liberia
    whatsapp_number = Column(String(20), nullable=True) #e.g +231 777 123 4567
    emergency_contact = Column(String(255), nullable=True) #e.g John Doe, +231 777 123 4567

    status = Column(
        String(20),
        nullable=False,
        default="active",
        comment="One of: active, graduated, transferred, withdrawn"
    )
    exit_date         = Column(Date, nullable=True)
    graduation_date   = Column(Date, nullable=True)
    withdrawal_reason = Column(String(255), nullable=True)
    
    __mapper_args__ = {
        "polymorphic_identity": "student",
    }

    def is_active(self) -> bool:
        return self.status == "active"

    def graduate(self, grad_date: date):
        self.status = "graduated"
        self.graduation_date = grad_date

    def withdraw(self, date_left: date, reason: str):
        self.status = "withdrawn"
        self.exit_date = date_left
        self.withdrawal_reason = reason

    def transfer(self, date_left: date, new_school: str, reason: str = None):
        self.status = "transferred"
        self.exit_date = date_left
        self.transfer_school = new_school
        self.transfer_reason = reason
    
    # Relationships
    # This will be defined when we implement enrollment and other academic models
    
    def __repr__(self):
        return f"<Student {self.email} - {self.admission_number}>"
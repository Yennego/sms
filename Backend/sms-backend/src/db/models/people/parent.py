from sqlalchemy import Column, String, ForeignKey, Table, Date
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.db.models.auth.user import User
from src.db.models.base import Base
from datetime import date

def _student_tenant(context):
    """parent_student.tenant_id is the student's school (filled in for links made through
    Parent.students, which only know the two ids)."""
    from sqlalchemy import select
    student_id = context.get_current_parameters()["student_id"]
    users = Base.metadata.tables["users"]
    return context.connection.execute(select(users.c.tenant_id).where(users.c.id == student_id)).scalar()


# Association table for many-to-many relationship between parents and students.
# tenant_id (the student's school): PostgreSQL keeps both ends in that school with the composite
# keys fk_tn_parent_student_student_id / fk_tn_parent_student_parent_id.
parent_student = Table(
    'parent_student',
    Base.metadata,
    Column('parent_id', UUID(as_uuid=True), ForeignKey('parents.id'), primary_key=True),
    Column('student_id', UUID(as_uuid=True), ForeignKey('students.id'), primary_key=True),
    Column('tenant_id', UUID(as_uuid=True), ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False,
           default=_student_tenant, index=True),
)

class Parent(User):
    """Model representing a parent in the system."""
    
    __tablename__ = "parents"
    
    # Link to parent table
    id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    
    # Parent-specific fields
    relationship_type = Column(String(50), nullable=False)
    occupation = Column(String(100), nullable=True)

    # Override address column from User model to avoid conflicts
    address = Column('parent_address', String(255), nullable=True)
    city = Column(String(50), nullable=True)
    county = Column(String(50), nullable=True)
    country = Column(String(50), nullable=True)
    whatsapp_number = Column(String(20), nullable=True)
    
    # Status & deactivation tracking
    status = Column(
        String(20),
        nullable=False,
        default="active",
        comment="One of: active, inactive"
    )
    deactivated_date = Column(Date, nullable=True)
    deactivation_reason = Column(String(255), nullable=True)

    __mapper_args__ = {
        "polymorphic_identity": "parent",
    }


    # Relationships
    students = relationship(
        "Student",
        secondary=parent_student,
        backref="parents",
        lazy="subquery"
    )


    def add_student(self, student: "Student"):
        if student not in self.students:
            self.students.append(student)

    def remove_student(self, student: "Student"):
        if student in self.students:
            self.students.remove(student)

    def deactivate(self, date_left: date, reason: str = None):
        """
        Mark this parent as inactive (e.g., no longer associated with any current students).
        """
        self.status = "inactive"
        self.deactivated_date = date_left
        self.deactivation_reason = reason

    # No is_active() here: it would hide the users.is_active column (sign-in checks it), so a
    # deactivated parent could still sign in. A parent's link status is `status`.

    # Relationships
    # students = relationship("Student", secondary=parent_student, backref="parents")
    
    def __repr__(self):
        return f"<Parent {self.email} - {self.relationship_type}>"

        
import uuid
from typing import Optional, Any, List
from sqlalchemy import Column, String, ForeignKey, Date, Boolean, Integer, Text, UniqueConstraint, Index
from sqlalchemy import event, inspect, update
from sqlalchemy.orm import relationship, Session
from sqlalchemy.orm.attributes import set_committed_value
from sqlalchemy.dialects.postgresql import UUID
from datetime import date

from src.db.models.base import TenantModel

class Enrollment(TenantModel):
    """Enhanced enrollment model with semester support and proper foreign key relationships.
    
    This model represents a student's enrollment in a specific grade and section
    for an academic year. It now uses proper foreign keys instead of string fields.
    """
    
    __tablename__ = "enrollments"
    
    # Core relationships
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    
    # UPDATED: Use foreign keys instead of string fields
    grade_id = Column(UUID(as_uuid=True), ForeignKey("academic_grades.id"), nullable=False)
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=False)

    # The class the student is in this year. academic_year_id/grade_id/section_id always equal
    # the class's: PostgreSQL enforces it with the composite key fk_tn_enrollments_class_id, and
    # sync_enrollment_classes() below keeps the ORM in step (it also runs on SQLite).
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)

    # Enrollment details
    semester = Column(Integer, nullable=False, default=1)  # 1 or 2
    enrollment_date = Column(Date, default=date.today)
    roll_number = Column(Integer)
    status = Column(String(20), default="active")  # active, completed, withdrawn, graduated
    is_active = Column(Boolean, default=True)
    withdrawal_date = Column(Date)
    withdrawal_reason = Column(Text)
    comments = Column(Text)
    
    # Semester-specific fields
    semester_1_status = Column(String(20), default="pending")  # pending, active, completed, failed
    semester_2_status = Column(String(20), default="pending")
    semester_1_completion_date = Column(Date)
    semester_2_completion_date = Column(Date)
    
    # DEPRECATED: Keep for backward compatibility during migration
    academic_year = Column(String(20), nullable=True)  # Will be removed after migration
    grade = Column(String(50), nullable=True)  # Will be removed after migration
    section = Column(String(10), nullable=True)  # Will be removed after migration
    
    # Relationships
    student = relationship("Student", back_populates="enrollments")
    academic_year_obj = relationship("AcademicYear", back_populates="enrollments")
    grade_obj = relationship("AcademicGrade", back_populates="enrollments")
    section_obj = relationship("Section", back_populates="enrollments")
    class_obj = relationship("Class", back_populates="enrollments")

    # New: Relationship to promotion status
    promotion_status = relationship("PromotionStatus", backref="enrollment", uselist=False)
    
    def can_promote_to_next_semester(self) -> bool:
        """Check if student can be promoted to next semester."""
        if self.semester == 1:
            return self.semester_1_status == "completed"
        return False  # Already in semester 2
    
    def can_promote_to_next_grade(self) -> bool:
        """Check if student can be promoted to next grade."""
        return (self.semester == 2 and 
                self.semester_1_status == "completed" and 
                self.semester_2_status == "completed")
    
    @property
    def grade_name(self) -> str:
        """Get the grade name from the related AcademicGrade object."""
        return self.grade_obj.name if self.grade_obj else self.grade or "Unknown"
    
    @property
    def student_name(self) -> str:
        """Get the student full name from the related Student object."""
        if self.student:
            return self.student.full_name or f"{self.student.first_name} {self.student.last_name}".strip() or "Unknown"
        return "Unknown"

    @property
    def section_name(self) -> str:
        """Get the section name from the related Section object."""
        return self.section_obj.name if self.section_obj else self.section or "Unknown"

    def __repr__(self):
        return f"<Enrollment {self.student_id} - {self.grade_name} {self.section_name} - {self.academic_year or 'Current'}>"
    
    __table_args__ = (
        UniqueConstraint(
            'tenant_id', 'student_id', 'academic_year_id',
            name='unique_enrollment_student_year'
        ),
        Index(
            'ix_enrollments_active_student',
            'tenant_id', 'student_id', 'is_active', 'status'
        ),
        Index('ix_enrollments_tenant_grade_year', 'tenant_id', 'grade_id', 'academic_year_id'),
        Index('ix_enrollments_tenant_section', 'tenant_id', 'section_id'),
        Index('ix_enrollments_tenant_class', 'tenant_id', 'class_id'),
    )


IDENTITY = ("academic_year_id", "grade_id", "section_id")


def _changed(obj, *names) -> bool:
    state = inspect(obj)
    return any(state.attrs[n].history.has_changes() for n in names)


def _class_for_identity(session, enrollment, pending):
    """The class with the enrollment's school/year/grade/section; created when missing."""
    from src.db.models.academics.class_model import Class
    from src.db.models.academics.academic_grade import AcademicGrade
    from src.db.models.academics.section import Section

    key = (enrollment.tenant_id, enrollment.academic_year_id, enrollment.grade_id, enrollment.section_id)
    if key in pending:
        return pending[key]
    # A class added in this same flush is not in the database yet
    cls = next((c for c in session.new if isinstance(c, Class)
                and (c.tenant_id, c.academic_year_id, c.grade_id, c.section_id) == key), None)
    if cls is None:
        cls = session.query(Class).filter(
            Class.tenant_id == enrollment.tenant_id,
            Class.academic_year_id == enrollment.academic_year_id,
            Class.grade_id == enrollment.grade_id,
            Class.section_id == enrollment.section_id,
        ).first()
    if cls is None:
        grade = session.query(AcademicGrade).filter(
            AcademicGrade.tenant_id == enrollment.tenant_id, AcademicGrade.id == enrollment.grade_id
        ).first()
        section = session.query(Section).filter(
            Section.tenant_id == enrollment.tenant_id, Section.id == enrollment.section_id
        ).first()
        if grade is None or section is None:
            raise ValueError("Enrollment grade or section not found in this school")
        cls = Class(
            tenant_id=enrollment.tenant_id, academic_year_id=enrollment.academic_year_id,
            grade_id=grade.id, section_id=section.id, name=f"{grade.name} - {section.name}",
        )
        cls.grade, cls.section = grade, section
        session.add(cls)
    pending[key] = cls
    return cls


def _copy_class(enrollment, cls) -> None:
    enrollment.class_obj = cls
    if cls.id is not None:  # a new class gets its id at flush; the relationship fills class_id then
        enrollment.class_id = cls.id
    for name in IDENTITY:
        setattr(enrollment, name, getattr(cls, name))
    # Legacy display mirrors (still read by older screens; the enrollments list requires the year)
    if cls.academic_year is not None:
        enrollment.academic_year = cls.academic_year.name
    if cls.grade is not None:
        enrollment.grade = cls.grade.name
    if cls.section is not None:
        enrollment.section = cls.section.name


@event.listens_for(Session, "before_flush")
def sync_enrollment_classes(session, flush_context, instances):
    """Keep every enrollment's year/grade/section equal to its class's.

    - class_id set or changed (enroll in / move to a class): copy the class's year/grade/section;
    - otherwise year/grade/section set or changed: use the class with that identity, creating it
      when the school has none yet (as the one_enrollment_table migration does).
    A class from another school is rejected.
    """
    from src.db.models.academics.class_model import Class

    pending = {}
    for obj in list(session.new) + list(session.dirty):
        if not isinstance(obj, Enrollment):
            continue
        is_new = obj in session.new
        # CRUD create passes ids through jsonable_encoder (strings); compare and query as UUIDs
        for name in ("tenant_id", "class_id") + IDENTITY:
            value = getattr(obj, name)
            if isinstance(value, str):
                setattr(obj, name, uuid.UUID(value))
        with session.no_autoflush:
            class_moved = obj.class_id is not None and (is_new or _changed(obj, "class_id"))
            if obj.class_obj is not None and (is_new or _changed(obj, "class_obj")):
                cls, class_moved = obj.class_obj, True
            elif class_moved:
                cls = session.query(Class).filter(
                    Class.id == obj.class_id, Class.tenant_id == obj.tenant_id
                ).first()
            if class_moved:
                if cls is None or cls.tenant_id != obj.tenant_id:
                    raise ValueError("Enrollment class not found in this school")
                _copy_class(obj, cls)
            elif is_new or obj.class_id is None or _changed(obj, *IDENTITY):
                _copy_class(obj, _class_for_identity(session, obj, pending))


@event.listens_for(Session, "after_flush")
def follow_class_identity(session, flush_context):
    """A class whose year/grade/section changed takes its enrollments along.

    PostgreSQL already does this (ON UPDATE CASCADE on fk_tn_enrollments_class_id); this keeps
    other databases (the SQLite tests) and the loaded objects consistent.
    """
    from src.db.models.academics.class_model import Class

    for obj in session.dirty:
        if isinstance(obj, Class) and _changed(obj, *IDENTITY):
            values = {name: getattr(obj, name) for name in IDENTITY}
            session.connection().execute(
                update(Enrollment.__table__)
                .where(Enrollment.__table__.c.tenant_id == obj.tenant_id,
                       Enrollment.__table__.c.class_id == obj.id)
                .values(**values)
            )
            for enrollment in session.identity_map.values():
                if isinstance(enrollment, Enrollment) and enrollment.class_id == obj.id:
                    for name, value in values.items():
                        set_committed_value(enrollment, name, value)

        
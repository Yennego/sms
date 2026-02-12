from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, Any

from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.academic_grade import AcademicGrade
from src.db.models.academics.section import Section
from src.db.models.academics.subject import Subject
from src.db.models.academics.class_model import Class
from src.db.models.academics.enrollment import Enrollment
from src.db.models.academics.semester import Semester
from src.db.models.people.teacher import Teacher
from src.db.models.people.student import Student
from src.schemas.academics.setup import AcademicSetupStatus

class AcademicSetupService:
    def __init__(self, db: Session, tenant_id: Any):
        from src.utils.uuid_utils import ensure_uuid
        self.db = db
        self.tenant_id = ensure_uuid(tenant_id)

    def get_setup_status(self) -> AcademicSetupStatus:
        # Get current year info
        current_year = self.db.query(AcademicYear).filter(
            AcademicYear.tenant_id == self.tenant_id,
            AcademicYear.is_current == True,
            AcademicYear.is_active == True
        ).first()

        current_year_id = current_year.id if current_year else None
        current_year_name = current_year.name if current_year else None

        # Fetch all counts in optimized queries
        
        counts = {
            "academic_years": self.db.query(func.count(AcademicYear.id)).filter(AcademicYear.tenant_id == self.tenant_id).scalar() or 0,
            "grades": self.db.query(func.count(AcademicGrade.id)).filter(AcademicGrade.tenant_id == self.tenant_id).scalar() or 0,
            "sections": self.db.query(func.count(Section.id)).filter(Section.tenant_id == self.tenant_id).scalar() or 0,
            "subjects": self.db.query(func.count(Subject.id)).filter(Subject.tenant_id == self.tenant_id).scalar() or 0,
            "classes": self.db.query(func.count(Class.id)).filter(Class.tenant_id == self.tenant_id, Class.is_active == True).scalar() or 0,
            "teachers": self.db.query(func.count(Teacher.id)).filter(Teacher.tenant_id == self.tenant_id, Teacher.status == 'active').scalar() or 0,
            "students": self.db.query(func.count(Student.id)).filter(Student.tenant_id == self.tenant_id, Student.status == 'active').scalar() or 0,
        }

        # Add counts that depend on current year
        if current_year:
            counts["teacher_assignments"] = self.db.query(func.count(Class.id)).filter(
                Class.tenant_id == self.tenant_id, 
                Class.is_active == True,
                Class.academic_year_id == current_year_id
            ).scalar() or 0
            
            counts["student_enrollments"] = self.db.query(func.count(Enrollment.id)).filter(
                Enrollment.tenant_id == self.tenant_id,
                Enrollment.status == 'active',
                Enrollment.academic_year_id == current_year_id
            ).scalar() or 0
            
            counts["semesters"] = self.db.query(func.count(Semester.id)).filter(
                Semester.tenant_id == self.tenant_id,
                Semester.academic_year_id == current_year_id
            ).scalar() or 0
        else:
            counts["teacher_assignments"] = 0
            counts["student_enrollments"] = 0
            counts["semesters"] = 0

        return AcademicSetupStatus(
            **counts,
            current_academic_year_id=current_year_id,
            current_academic_year_name=current_year_name
        )

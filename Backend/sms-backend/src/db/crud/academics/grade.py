from typing import Any, Dict, List, Optional, Union
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from datetime import date

from src.db.crud.base import TenantCRUDBase
from src.db.models.academics.grade import Grade, GradeType
from src.db.models.people.student import Student
from src.db.models.academics.subject import Subject
from src.db.models.auth.user import User
from src.schemas.academics.grade import GradeCreate, GradeUpdate


class CRUDGrade(TenantCRUDBase[Grade, GradeCreate, GradeUpdate]):
    """CRUD operations for Grade model."""
    
    def get_by_student_subject(self, db: Session, tenant_id: Any, student_id: Any, subject_id: Any) -> List[Grade]:
        """Get all grades for a student in a specific subject within a tenant."""
        return db.query(Grade).filter(
            Grade.tenant_id == tenant_id,
            Grade.student_id == student_id,
            Grade.subject_id == subject_id
        ).all()
    
    def get_by_enrollment_subject(self, db: Session, tenant_id: Any, enrollment_id: Any, subject_id: Any) -> List[Grade]:
        """Get all grades for an enrollment in a specific subject within a tenant."""
        return db.query(Grade).filter(
            Grade.tenant_id == tenant_id,
            Grade.enrollment_id == enrollment_id,
            Grade.subject_id == subject_id
        ).all()
    
    def get_by_assessment(self, db: Session, tenant_id: Any, assessment_type: GradeType, assessment_id: Any) -> List[Grade]:
        """Get all grades for a specific assessment within a tenant."""
        return db.query(Grade).filter(
            Grade.tenant_id == tenant_id,
            Grade.assessment_type == assessment_type,
            Grade.assessment_id == assessment_id
        ).all()
    
    def get_with_details(self, db: Session, tenant_id: Any, id: Any) -> Optional[Dict]:
        """Get grade with additional details."""
        result = db.query(
            Grade,
            Student.full_name.label("student_name"),
            Subject.name.label("subject_name"),
            User.full_name.label("teacher_name")
        ).join(Student, Grade.student_id == Student.id
        ).join(Subject, Grade.subject_id == Subject.id
        ).join(User, Grade.graded_by == User.id
        ).filter(
            Grade.tenant_id == tenant_id,
            Grade.id == id
        ).first()
        
        if not result:
            return None
            
        grade_dict = {c.name: getattr(result[0], c.name) for c in result[0].__table__.columns}
        grade_dict.update({
            "student_name": result.student_name,
            "subject_name": result.subject_name,
            "teacher_name": result.teacher_name
        })
        return grade_dict
    
    def calculate_subject_average(self, db: Session, tenant_id: Any, student_id: Any, subject_id: Any) -> Optional[float]:
        """Calculate the average percentage for a student in a subject."""
        result = db.query(func.avg(Grade.percentage)).filter(
            Grade.tenant_id == tenant_id,
            Grade.student_id == student_id,
            Grade.subject_id == subject_id
        ).scalar()
        
        return float(result) if result is not None else None
    
    def calculate_weighted_average(self, db: Session, tenant_id: Any, student_id: Any, subject_id: Any, 
                                  weights: Dict[GradeType, float]) -> Optional[float]:
        """Calculate the weighted average percentage for a student in a subject."""
        grades = self.get_by_student_subject(db, tenant_id, student_id, subject_id)
        
        if not grades:
            return None
            
        total_weight = 0.0
        weighted_sum = 0.0
        
        for grade in grades:
            weight = weights.get(grade.assessment_type, 1.0)
            weighted_sum += grade.percentage * weight
            total_weight += weight
        
        return weighted_sum / total_weight if total_weight > 0 else None


grade = CRUDGrade(Grade)
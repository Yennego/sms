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
        from sqlalchemy.orm import joinedload
        return db.query(Grade).options(
            joinedload(Grade.student),
            joinedload(Grade.subject),
            joinedload(Grade.enrollment)
        ).filter(
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
        
    
    def bulk_create_grades(self, db: Session, tenant_id: Any, obj_in_list: List[GradeCreate]) -> List[Grade]:
        """Bulk create or update multiple grade records (Upsert) efficiently."""
        if not obj_in_list:
            return []

        # Extract common identifiers for bulk fetch
        student_ids = [obj.student_id for obj in obj_in_list]
        assessment_ids = list(set(obj.assessment_id for obj in obj_in_list))
        assessment_types = list(set(obj.assessment_type for obj in obj_in_list))
        subject_ids = list(set(obj.subject_id for obj in obj_in_list))

        # Bulk fetch existing grades to avoid N+1
        existing_grades = db.query(Grade).filter(
            Grade.tenant_id == tenant_id,
            Grade.student_id.in_(student_ids),
            Grade.assessment_id.in_(assessment_ids),
            Grade.assessment_type.in_(assessment_types),
            Grade.subject_id.in_(subject_ids)
        ).all()

        # Create a lookup map: (student_id, assessment_id, assessment_type, subject_id) -> Grade
        existing_map = {
            (g.student_id, g.assessment_id, g.assessment_type, g.subject_id): g
            for g in existing_grades
        }

        db_objs = []
        for obj_in in obj_in_list:
            obj_in_data = obj_in.model_dump()
            key = (obj_in.student_id, obj_in.assessment_id, obj_in.assessment_type, obj_in.subject_id)
            
            existing_grade = existing_map.get(key)
            
            if existing_grade:
                # Update existing record
                for k, v in obj_in_data.items():
                    setattr(existing_grade, k, v)
                db_objs.append(existing_grade)
            else:
                # Create new record
                db_obj = Grade(**obj_in_data, tenant_id=tenant_id)
                db.add(db_obj)
                db_objs.append(db_obj)
        
        db.commit()
        # No need to refresh all if we just want to return the objects
        # SQLAlchemy handles the object state since they are still in session
        return db_objs


grade = CRUDGrade(Grade)


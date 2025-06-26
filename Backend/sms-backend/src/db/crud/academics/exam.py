from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date, time
from sqlalchemy.orm import Session
from sqlalchemy import and_

from src.db.crud.base.base import TenantCRUDBase
from src.db.models.academics.exam import Exam
from src.schemas.academics.exam import ExamCreate, ExamUpdate


class CRUDExam(TenantCRUDBase[Exam, ExamCreate, ExamUpdate]):
    """CRUD operations for Exam model."""
    
    def get_by_subject(self, db: Session, tenant_id: Any, subject_id: Any) -> List[Exam]:
        """Get all exams for a specific subject within a tenant."""
        return db.query(Exam).filter(
            Exam.tenant_id == tenant_id,
            Exam.subject_id == subject_id
        ).all()
    
    def get_by_teacher(self, db: Session, tenant_id: Any, teacher_id: Any) -> List[Exam]:
        """Get all exams created by a specific teacher within a tenant."""
        return db.query(Exam).filter(
            Exam.tenant_id == tenant_id,
            Exam.teacher_id == teacher_id
        ).all()
    
    def get_by_grade_section(self, db: Session, tenant_id: Any, grade_id: Any, section_id: Optional[Any] = None) -> List[Exam]:
        """Get all exams for a specific grade and optionally section within a tenant."""
        query = db.query(Exam).filter(
            Exam.tenant_id == tenant_id,
            Exam.grade_id == grade_id
        )
        
        if section_id:
            query = query.filter(Exam.section_id == section_id)
        
        return query.all()
    
    def get_published(self, db: Session, tenant_id: Any) -> List[Exam]:
        """Get all published exams within a tenant."""
        return db.query(Exam).filter(
            Exam.tenant_id == tenant_id,
            Exam.is_published == True
        ).all()
    
    def get_upcoming(self, db: Session, tenant_id: Any, days: int = 7) -> List[Exam]:
        """Get all exams scheduled within the next X days within a tenant."""
        today = date.today()
        end_date = today + timedelta(days=days)
        
        return db.query(Exam).filter(
            Exam.tenant_id == tenant_id,
            Exam.exam_date.between(today, end_date)
        ).all()
    
    def get_with_details(self, db: Session, tenant_id: Any, id: Any) -> Optional[Dict]:
        """Get exam with additional details within a tenant."""
        exam = db.query(Exam).filter(
            Exam.tenant_id == tenant_id,
            Exam.id == id
        ).first()
        
        if not exam:
            return None
        
        # Get related data
        subject_name = exam.subject.name if exam.subject else "Unknown"
        teacher_name = f"{exam.teacher.first_name} {exam.teacher.last_name}" if exam.teacher else "Unknown"
        grade_name = exam.grade.name if exam.grade else "Unknown"
        section_name = exam.section.name if exam.section else None
        
        # Combine into a dictionary
        result = {
            "id": exam.id,
            "title": exam.title,
            "description": exam.description,
            "subject_id": exam.subject_id,
            "subject_name": subject_name,
            "teacher_id": exam.teacher_id,
            "teacher_name": teacher_name,
            "grade_id": exam.grade_id,
            "grade_name": grade_name,
            "section_id": exam.section_id,
            "section_name": section_name,
            "exam_date": exam.exam_date,
            "start_time": exam.start_time,
            "end_time": exam.end_time,
            "max_score": exam.max_score,
            "weight": exam.weight,
            "is_published": exam.is_published,
            "location": exam.location,
            "instructions": exam.instructions,
            "tenant_id": exam.tenant_id,
            "created_at": exam.created_at,
            "updated_at": exam.updated_at
        }
        
        return result
    
    def update_publication_status(self, db: Session, tenant_id: Any, id: Any, is_published: bool) -> Exam:
        """Update an exam's publication status within a tenant."""
        exam = db.query(Exam).filter(
            Exam.tenant_id == tenant_id,
            Exam.id == id
        ).first()
        
        if not exam:
            return None
        
        exam.is_published = is_published
        db.add(exam)
        db.commit()
        db.refresh(exam)
        
        return exam


exam_crud = CRUDExam(Exam)
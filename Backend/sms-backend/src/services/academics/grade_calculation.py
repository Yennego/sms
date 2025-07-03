from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import date

from src.db.crud.academics import grade as grade_crud
from src.db.crud.academics import subject as subject_crud
from src.db.crud.people import student as student_crud
from src.db.models.academics.grade import Grade, GradeType
from src.schemas.academics.grade import GradeCreate, GradeUpdate
from src.services.base.base import TenantBaseService, SuperAdminBaseService
from src.core.exceptions.business import (
    EntityNotFoundError, 
    BusinessRuleViolationError
)

class GradeCalculationService(TenantBaseService[Grade, GradeCreate, GradeUpdate]):
    """Service for calculating and managing student grades within a tenant."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=grade_crud, model=Grade, *args, **kwargs)
    
    def get_by_student_subject(self, student_id: UUID, subject_id: UUID) -> List[Grade]:
        """Get all grades for a student in a specific subject."""
        return grade_crud.get_by_student_subject(
            self.db, tenant_id=self.tenant_id, student_id=student_id, subject_id=subject_id
        )
    
    def get_by_enrollment_subject(self, enrollment_id: UUID, subject_id: UUID) -> List[Grade]:
        """Get all grades for an enrollment in a specific subject."""
        return grade_crud.get_by_enrollment_subject(
            self.db, tenant_id=self.tenant_id, enrollment_id=enrollment_id, subject_id=subject_id
        )
    
    def get_by_assessment(self, assessment_type: GradeType, assessment_id: UUID) -> List[Grade]:
        """Get all grades for a specific assessment."""
        return grade_crud.get_by_assessment(
            self.db, tenant_id=self.tenant_id, assessment_type=assessment_type, assessment_id=assessment_id
        )
    
    def get_with_details(self, id: UUID) -> Optional[Dict]:
        """Get grade with additional details."""
        return grade_crud.get_with_details(
            self.db, tenant_id=self.tenant_id, id=id
        )
    
    def create(self, *, obj_in: GradeCreate) -> Grade:
        """Create a new grade with validation."""
        # Check if student exists
        student = student_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=obj_in.student_id)
        if not student:
            raise EntityNotFoundError("Student", obj_in.student_id)
        
        # Check if subject exists
        subject = subject_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=obj_in.subject_id)
        if not subject:
            raise EntityNotFoundError("Subject", obj_in.subject_id)
        
        # Validate score and max_score
        if obj_in.score < 0 or obj_in.max_score <= 0 or obj_in.score > obj_in.max_score:
            raise BusinessRuleViolationError(f"Invalid score ({obj_in.score}) or max_score ({obj_in.max_score})")
        
        # Calculate percentage if not provided
        if not obj_in.percentage:
            obj_in.percentage = (obj_in.score / obj_in.max_score) * 100
        
        # Determine letter grade if not provided
        if not obj_in.letter_grade:
            obj_in.letter_grade = self._calculate_letter_grade(obj_in.percentage)
        
        # Create the grade
        return super().create(obj_in=obj_in)
    
    def update_grade(self, id: UUID, score: float, max_score: float, comments: Optional[str] = None) -> Grade:
        """Update a grade's score and recalculate percentage and letter grade."""
        grade = self.get(id=id)
        if not grade:
            raise EntityNotFoundError("Grade", id)
        
        # Validate score and max_score
        if score < 0 or max_score <= 0 or score > max_score:
            raise BusinessRuleViolationError(f"Invalid score ({score}) or max_score ({max_score})")
        
        # Calculate percentage
        percentage = (score / max_score) * 100
        
        # Determine letter grade
        letter_grade = self._calculate_letter_grade(percentage)
        
        # Update the grade
        update_data = {
            "score": score,
            "max_score": max_score,
            "percentage": percentage,
            "letter_grade": letter_grade,
            "graded_date": date.today()
        }
        
        if comments is not None:
            update_data["comments"] = comments
        
        return self.update(id=id, obj_in=update_data)
    
    def calculate_subject_average(self, student_id: UUID, subject_id: UUID) -> Optional[float]:
        """Calculate the average percentage for a student in a subject."""
        return grade_crud.calculate_subject_average(
            self.db, tenant_id=self.tenant_id, student_id=student_id, subject_id=subject_id
        )
    
    def calculate_weighted_average(self, student_id: UUID, subject_id: UUID, 
                                 weights: Dict[GradeType, float]) -> Optional[float]:
        """Calculate the weighted average percentage for a student in a subject."""
        return grade_crud.calculate_weighted_average(
            self.db, tenant_id=self.tenant_id, student_id=student_id, subject_id=subject_id, weights=weights
        )
    
    def calculate_gpa(self, student_id: UUID, academic_year: str) -> Optional[float]:
        """Calculate the GPA for a student in a specific academic year."""
        # Get all subjects for the student in the academic year
        # For each subject, calculate the average grade
        # Calculate the GPA based on the average grades and subject credits
        # This is a simplified implementation
        
        # Get all grades for the student in the academic year
        grades = self.db.query(Grade).filter(
            Grade.tenant_id == self.tenant_id,
            Grade.student_id == student_id,
            # Filter by academic year using the enrollment
            Grade.enrollment.has(academic_year=academic_year)
        ).all()
        
        if not grades:
            return None
        
        # Group grades by subject
        subject_grades = {}
        for grade in grades:
            if grade.subject_id not in subject_grades:
                subject_grades[grade.subject_id] = []
            subject_grades[grade.subject_id].append(grade)
        
        # Calculate average grade for each subject
        subject_averages = {}
        for subject_id, grades in subject_grades.items():
            total_percentage = sum(grade.percentage for grade in grades)
            subject_averages[subject_id] = total_percentage / len(grades)
        
        # Get subject credits
        subject_credits = {}
        for subject_id in subject_averages.keys():
            subject = subject_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=subject_id)
            if subject:
                subject_credits[subject_id] = subject.credits
            else:
                subject_credits[subject_id] = 1  # Default to 1 credit if subject not found
        
        # Calculate GPA
        total_credits = sum(subject_credits.values())
        weighted_sum = sum(subject_averages[subject_id] * subject_credits[subject_id] for subject_id in subject_averages.keys())
        
        return weighted_sum / total_credits if total_credits > 0 else None
    
    def generate_report_card(self, student_id: UUID, academic_year: str) -> Dict[str, Any]:
        """Generate a report card for a student in a specific academic year."""
        # Get student details
        student = student_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=student_id)
        if not student:
            raise EntityNotFoundError("Student", student_id)
        
        # Get all grades for the student in the academic year
        grades = self.db.query(Grade).filter(
            Grade.tenant_id == self.tenant_id,
            Grade.student_id == student_id,
            # Filter by academic year using the enrollment
            Grade.enrollment.has(academic_year=academic_year)
        ).all()
        
        # Group grades by subject
        subject_grades = {}
        for grade in grades:
            if grade.subject_id not in subject_grades:
                subject = subject_crud.get_by_id(self.db, tenant_id=self.tenant_id, id=grade.subject_id)
                subject_name = subject.name if subject else "Unknown Subject"
                subject_grades[grade.subject_id] = {
                    "subject_id": grade.subject_id,
                    "subject_name": subject_name,
                    "grades": []
                }
            
            subject_grades[grade.subject_id]["grades"].append({
                "id": grade.id,
                "assessment_type": grade.assessment_type,
                "assessment_name": grade.assessment_name,
                "assessment_date": grade.assessment_date,
                "score": grade.score,
                "max_score": grade.max_score,
                "percentage": grade.percentage,
                "letter_grade": grade.letter_grade
            })
        
        # Calculate average for each subject
        for subject_id, data in subject_grades.items():
            grades_list = data["grades"]
            if grades_list:
                total_percentage = sum(grade["percentage"] for grade in grades_list)
                data["average_percentage"] = total_percentage / len(grades_list)
                data["average_letter_grade"] = self._calculate_letter_grade(data["average_percentage"])
            else:
                data["average_percentage"] = None
                data["average_letter_grade"] = None
        
        # Calculate GPA
        gpa = self.calculate_gpa(student_id, academic_year)
        
        # Create report card
        report_card = {
            "student_id": student_id,
            "student_name": student.full_name,
            "admission_number": student.admission_number,
            "academic_year": academic_year,
            "grade": student.grade,
            "section": student.section,
            "subjects": list(subject_grades.values()),
            "gpa": gpa,
            "generated_date": date.today().isoformat()
        }
        
        return report_card
    
    def _calculate_letter_grade(self, percentage: float) -> str:
        """Calculate letter grade based on percentage."""
        if percentage >= 90:
            return "A"
        elif percentage >= 80:
            return "B"
        elif percentage >= 70:
            return "C"
        elif percentage >= 60:
            return "D"
        else:
            return "F"


class SuperAdminGradeCalculationService(SuperAdminBaseService[Grade, GradeCreate, GradeUpdate]):
    """Super-admin service for managing grades across all tenants."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(crud=grade_crud, model=Grade, *args, **kwargs)
    
    def get_all_grades(self, skip: int = 0, limit: int = 100,
                      student_id: Optional[UUID] = None,
                      subject_id: Optional[UUID] = None,
                      assessment_type: Optional[GradeType] = None,
                      tenant_id: Optional[UUID] = None) -> List[Grade]:
        """Get all grades across all tenants with filtering."""
        query = self.db.query(Grade)
        
        # Apply filters
        if student_id:
            query = query.filter(Grade.student_id == student_id)
        if subject_id:
            query = query.filter(Grade.subject_id == subject_id)
        if assessment_type:
            query = query.filter(Grade.assessment_type == assessment_type)
        if tenant_id:
            query = query.filter(Grade.tenant_id == tenant_id)
        
        # Apply pagination
        return query.offset(skip).limit(limit).all()


from typing import List, Dict, Any, Optional, Literal
from uuid import UUID
from datetime import date
from sqlalchemy.orm import Session

from src.db.crud.academics import enrollment_crud, academic_year_crud
from src.db.crud.academics.academic_grade import academic_grade_crud
from src.db.crud.people import student_crud
from src.services.base.base import TenantBaseService
from src.schemas.academics.enrollment import EnrollmentCreate
from src.core.exceptions.business import BusinessRuleViolationError

PromotionType = Literal["semester", "grade", "graduation"]

class PromotionService(TenantBaseService):
    """Enhanced service for handling semester and grade promotions."""
    
    def __init__(self, db: Session, tenant_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
    
    def bulk_promote_students(
        self, 
        student_ids: List[UUID], 
        promotion_type: PromotionType,
        target_academic_year: Optional[str] = None,
        target_semester: Optional[int] = None,
        promotion_rules: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Promote multiple students (semester or grade promotion)."""
        
        results = {
            "semester_promoted": [],
            "grade_promoted": [],
            "graduated": [],
            "failed": [],
            "errors": []
        }
        
        # Get all academic grades with sequence
        grades = academic_grade_crud.get_active_grades(self.db, self.tenant_id)
        grade_sequence = {grade.name: grade.sequence for grade in grades}
        max_sequence = max(grade_sequence.values()) if grade_sequence else 12
        
        for student_id in student_ids:
            try:
                # Get current enrollment
                current_enrollment = enrollment_crud.get_active_enrollment(
                    self.db, self.tenant_id, student_id
                )
                
                if not current_enrollment:
                    results["errors"].append({
                        "student_id": student_id,
                        "error": "No active enrollment found"
                    })
                    continue
                
                if promotion_type == "semester":
                    result = self._promote_to_next_semester(current_enrollment, target_semester)
                elif promotion_type == "grade":
                    result = self._promote_to_next_grade(
                        current_enrollment, target_academic_year, grade_sequence, max_sequence, promotion_rules
                    )
                elif promotion_type == "graduation":
                    result = self._graduate_student(current_enrollment)
                
                # Add result to appropriate category
                if result["type"] == "semester_promotion":
                    results["semester_promoted"].append(result)
                elif result["type"] == "grade_promotion":
                    results["grade_promoted"].append(result)
                elif result["type"] == "graduation":
                    results["graduated"].append(result)
                elif result["type"] == "error":
                    results["errors"].append(result)
                    
            except Exception as e:
                results["errors"].append({
                    "student_id": student_id,
                    "error": str(e),
                    "type": "error"
                })
        
        return results
    
    def _promote_to_next_semester(self, current_enrollment, target_semester: Optional[int] = None) -> Dict[str, Any]:
        """Promote student to next semester within same grade."""
        if not current_enrollment.can_promote_to_next_semester():
            return {
                "student_id": current_enrollment.student_id,
                "error": "Student cannot be promoted to next semester",
                "type": "error"
            }
        
        if current_enrollment.semester == 1:
            # Promote to semester 2
            enrollment_crud.update(
                self.db,
                db_obj=current_enrollment,
                obj_in={
                    "semester": 2,
                    "semester_2_status": "active",
                    "comments": f"Promoted to Semester 2 on {date.today()}"
                }
            )
            
            return {
                "student_id": current_enrollment.student_id,
                "from_semester": 1,
                "to_semester": 2,
                "grade": current_enrollment.grade,
                "academic_year": current_enrollment.academic_year,
                "type": "semester_promotion"
            }
        
        return {
            "student_id": current_enrollment.student_id,
            "error": "Already in final semester",
            "type": "error"
        }
    
    def _promote_to_next_grade(
        self, 
        current_enrollment, 
        target_academic_year: str, 
        grade_sequence: Dict[str, int], 
        max_sequence: int,
        promotion_rules: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Promote student to next grade."""
        
        if not current_enrollment.can_promote_to_next_grade():
            return {
                "student_id": current_enrollment.student_id,
                "error": "Student has not completed both semesters",
                "type": "error"
            }
        
        current_grade = current_enrollment.grade
        current_sequence = grade_sequence.get(current_grade, 0)
        
        # Check if student should graduate
        if current_sequence >= max_sequence:
            return self._graduate_student(current_enrollment)
        
        # Find next grade
        next_sequence = current_sequence + 1
        next_grade = None
        for grade_name, sequence in grade_sequence.items():
            if sequence == next_sequence:
                next_grade = grade_name
                break
        
        if not next_grade:
            return {
                "student_id": current_enrollment.student_id,
                "error": f"No next grade found for sequence {next_sequence}",
                "type": "error"
            }
        
        # Apply promotion rules if provided
        target_section = promotion_rules.get(str(current_enrollment.student_id)) if promotion_rules else current_enrollment.section
        
        # Mark current enrollment as completed
        enrollment_crud.update(
            self.db,
            db_obj=current_enrollment,
            obj_in={"status": "completed", "is_active": False}
        )
        
        # Create new enrollment for next grade (starting with semester 1)
        new_enrollment_data = EnrollmentCreate(
            student_id=current_enrollment.student_id,
            academic_year=target_academic_year,
            semester=1,
            grade=next_grade,
            section=target_section or current_enrollment.section,
            enrollment_date=date.today(),
            status="active",
            is_active=True,
            semester_1_status="active",
            semester_2_status="pending",
            comments=f"Promoted from {current_grade} to {next_grade} on {date.today()}"
        )
        
        new_enrollment = enrollment_crud.create_with_tenant(
            self.db, obj_in=new_enrollment_data, tenant_id=self.tenant_id
        )
        
        return {
            "student_id": current_enrollment.student_id,
            "from_grade": current_grade,
            "to_grade": next_grade,
            "from_academic_year": current_enrollment.academic_year,
            "to_academic_year": target_academic_year,
            "enrollment_id": new_enrollment.id,
            "type": "grade_promotion"
        }
    
    def _graduate_student(self, current_enrollment) -> Dict[str, Any]:
        """Graduate a student (mark as completed, no new enrollment)."""
        enrollment_crud.update(
            self.db,
            db_obj=current_enrollment,
            obj_in={
                "status": "graduated", 
                "is_active": False,
                "comments": f"Graduated from {current_enrollment.grade} on {date.today()}"
            }
        )
        
        # Update student status
        student = student_crud.get(self.db, id=current_enrollment.student_id)
        if student:
            student_crud.update(
                self.db,
                db_obj=student,
                obj_in={"status": "graduated"}
            )
        
        return {
            "student_id": current_enrollment.student_id,
            "from_grade": current_enrollment.grade,
            "academic_year": current_enrollment.academic_year,
            "graduation_date": date.today(),
            "type": "graduation"
        }
    
    def promote_semester_for_grade(
        self, 
        grade: str, 
        section: Optional[str] = None,
        target_semester: int = 2
    ) -> Dict[str, Any]:
        """Promote all students in a grade/section to next semester."""
        
        # Get all students in semester 1 of the specified grade
        query_filters = {
            "grade": grade,
            "semester": 1,
            "semester_1_status": "completed",
            "status": "active"
        }
        if section:
            query_filters["section"] = section
        
        enrollments = enrollment_crud.get_multi_by_filters(
            self.db, tenant_id=self.tenant_id, **query_filters
        )
        
        student_ids = [enrollment.student_id for enrollment in enrollments]
        
        return self.bulk_promote_students(
            student_ids=student_ids,
            promotion_type="semester",
            target_semester=target_semester
        )
    
    def promote_grade_level(
        self, 
        from_grade: str, 
        from_section: Optional[str],
        target_academic_year: str,
        target_section_mapping: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Promote all students in a grade/section to next grade."""
        
        # Get all students who completed both semesters
        query_filters = {
            "grade": from_grade,
            "semester": 2,
            "semester_1_status": "completed",
            "semester_2_status": "completed",
            "status": "active"
        }
        if from_section:
            query_filters["section"] = from_section
        
        enrollments = enrollment_crud.get_multi_by_filters(
            self.db, tenant_id=self.tenant_id, **query_filters
        )
        
        student_ids = [enrollment.student_id for enrollment in enrollments]
        
        return self.bulk_promote_students(
            student_ids=student_ids,
            promotion_type="grade",
            target_academic_year=target_academic_year,
            promotion_rules=target_section_mapping
        )
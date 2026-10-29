# module imports
from typing import List, Dict, Any, Optional, Literal
from uuid import UUID
from datetime import date
from sqlalchemy.orm import Session

from src.db.crud.academics import enrollment as enrollment_crud
from src.db.crud.academics.academic_year_crud import academic_year_crud
from src.db.crud.academics.academic_grade import academic_grade as academic_grade_crud
from src.db.crud.people import student as student_crud
from src.services.base.base import TenantBaseService
from src.schemas.academics.enrollment import EnrollmentCreate
from src.core.exceptions.business import BusinessRuleViolationError
from fastapi import Depends
from src.core.middleware.tenant import get_tenant_from_request
from src.db.session import get_db

PromotionType = Literal["semester", "grade", "graduation"]


# Evaluation status for a student with no grades recorded: no promotion decision yet
NOT_GRADED = "Not graded"

class PromotionService(TenantBaseService):
    """Enhanced service for handling semester and grade promotions."""
    
    def __init__(self, tenant: Any = Depends(get_tenant_from_request), db: Session = Depends(get_db)):
        tenant_id = tenant.id if hasattr(tenant, "id") else tenant
        self.tenant_id = tenant_id
        self.db = db
        self._results_cache = {}  # class id -> ClassResults, shared by evaluations in one request

    async def process_year_end_transition(self, current_year_id: UUID, target_year_name: str) -> Dict[str, Any]:
        """Processes year-end transitions: Promoting passing students and flagging failures for remedial."""
        from src.services.academics.remedial_service import RemedialService
        from src.db.models.academics.enrollment import Enrollment as EnrollmentModel
        
        # Students without grades aren't judged: they're listed as skipped, not held back
        results = {"promoted": [], "remedial": [], "skipped": [], "errors": []}
        
        # 1. Get all active enrollments for the year
        enrollments = self.db.query(EnrollmentModel).filter(
            EnrollmentModel.tenant_id == self.tenant_id,
            EnrollmentModel.academic_year_id == current_year_id,
            EnrollmentModel.is_active == True
        ).all()
        
        # 2. Get grade sequence
        grades = academic_grade_crud.get_active_grades(self.db, tenant_id=self.tenant_id)
        grade_sequence = {grade.name: grade.sequence for grade in grades}
        max_sequence = max(grade_sequence.values()) if grade_sequence else 12
        
        remedial_service = RemedialService(tenant=self.tenant_id, db=self.db)
        
        for en in enrollments:
            try:
                # Evaluate eligibility
                eval_res = await self.evaluate_eligibility(en.id)

                if eval_res["status"] == NOT_GRADED:
                    results["skipped"].append({"student_id": en.student_id, "reason": eval_res["notes"]})
                elif eval_res["status"] == "Eligible":
                    # Promote
                    promo_res = await self._promote_to_next_grade(
                        en, target_year_name, grade_sequence, max_sequence
                    )
                    results["promoted"].append({"student_id": en.student_id, "res": promo_res})
                else:
                    # Failed/Conditional -> Remedial
                    # Mark current enrollment as 'remedial' state (or keep active for remedial)
                    for subject_id in eval_res.get("failed_subject_ids", []):
                        await remedial_service.assign(
                            student_id=en.student_id,
                            subject_id=subject_id,
                            academic_year_id=current_year_id,
                            scheduled_date=date.today()
                        )
                    results["remedial"].append({
                        "student_id": en.student_id, 
                        "status": eval_res["status"], 
                        "failed_subjects": len(eval_res.get("failed_subject_ids", []))
                    })
            except Exception as e:
                results["errors"].append({"student_id": en.student_id, "error": str(e)})
                
        return results
    
    async def bulk_promote_students(
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
        grades = academic_grade_crud.get_active_grades(self.db, tenant_id=self.tenant_id)
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
                    result = await self._promote_to_next_semester(current_enrollment, target_semester)
                elif promotion_type == "grade":
                    result = await self._promote_to_next_grade(
                        current_enrollment, target_academic_year, grade_sequence, max_sequence, promotion_rules
                    )
                elif promotion_type == "graduation":
                    result = await self._graduate_student(current_enrollment)
                
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
    
    async def _promote_to_next_semester(self, current_enrollment, target_semester: Optional[int] = None) -> Dict[str, Any]:
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
                self.tenant_id,
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
    
    async def evaluate_eligibility(self, enrollment_id: UUID) -> Dict[str, Any]:
        from src.db.models.academics.enrollment import Enrollment as EnrollmentModel
        from src.db.models.academics.grade import Grade
        from src.services.academics.promotion_criteria_service import PromotionCriteriaService
        from src.services.academics.promotion_status_service import PromotionStatusService
        from src.services.academics.attendance_service import AttendanceService

        enrollment = self.db.query(EnrollmentModel).filter(
            EnrollmentModel.tenant_id == self.tenant_id,
            EnrollmentModel.id == enrollment_id
        ).first()
        if not enrollment:
            return {
                "student_id": None,
                "enrollment_id": enrollment_id,
                "status": "Repeating",
                "failed_subject_ids": [],
                "total_score": 0.0,
                "notes": "Enrollment not found"
            }

        criteria_service = PromotionCriteriaService(tenant=self.tenant_id, db=self.db)
        criteria = criteria_service.get_by_year_and_grade(
            academic_year_id=enrollment.academic_year_id, grade_id=enrollment.grade_id
        )

        passing_mark = criteria.passing_mark if criteria else 70
        min_passed_subjects = criteria.min_passed_subjects if criteria else None
        require_core_pass = criteria.require_core_pass if criteria else True
        core_subject_ids = criteria.core_subject_ids or [] if criteria else []
        aggregate_method = criteria.aggregate_method if criteria else "average"
        weighting_schema = criteria.weighting_schema if criteria else None
        
        # 1. Fetch Student and Section details early
        from src.db.models.auth.user import User
        user = self.db.query(User).filter(User.id == enrollment.student_id).first()
        student_name = f"{user.first_name} {user.last_name}" if user else f"Student {str(enrollment.student_id)[:8]}"
        
        from src.db.models.academics.section import Section
        section = self.db.query(Section).filter(Section.id == enrollment.section_id).first()
        section_name = section.name if section else "Unknown"

        # 2. Published yearly averages per subject (phase4-design.md §1): a subject fails when its
        # yearly average is below the pass mark (school setting, overridden by the criteria)
        from src.services.academics.results_service import subject_outcomes
        passing_mark, subject_avg, overall = subject_outcomes(
            self.db, self.tenant_id, enrollment, cache=self._results_cache
        )
        avg_subject_score = overall if overall is not None else 0.0
        failed_subject_ids = [sid for sid, avg in subject_avg.items() if avg < passing_mark]

        # 3. Calculate Total Score (Weighted or Average)
        if aggregate_method == "weighted" and weighting_schema:
            total_weighted = 0.0
            weight_sum = 0.0
            
            # Subject Grades Contribution
            subjects_weight = sum([float(v) for k, v in weighting_schema.items() if k != 'attendance'])
            if subjects_weight > 0:
                total_weighted += avg_subject_score * subjects_weight
                weight_sum += subjects_weight
                
            # Attendance Contribution
            attendance_weight = float(weighting_schema.get('attendance', 0.0))
            if attendance_weight > 0:
                att_service = AttendanceService(tenant=self.tenant_id, db=self.db)
                ay = academic_year_crud.get_by_id(self.db, self.tenant_id, enrollment.academic_year_id)
                att_percentage = await att_service.get_student_attendance_percentage(
                    student_id=enrollment.student_id,
                    start_date=ay.start_date if ay else None,
                    end_date=ay.end_date if ay else None
                )
                total_weighted += att_percentage * attendance_weight
                weight_sum += attendance_weight
                
            total_score = (total_weighted / weight_sum) if weight_sum > 0 else avg_subject_score
        else:
            total_score = avg_subject_score

        # 4. Determine Status. No published results means nothing to judge yet: "Not graded",
        # never "Repeating"
        if not subject_avg:
            status = NOT_GRADED
            notes = "No published results yet"
        else:
            status = "Eligible"
            notes = ""
            if require_core_pass and any(sid in failed_subject_ids for sid in core_subject_ids):
                status = "Repeating"
                notes = "Core subject failed"
            elif len(failed_subject_ids) > 0:
                status = "Conditional"
                notes = f"{len(failed_subject_ids)} subjects failed"
            
            if min_passed_subjects is not None:
                passed_count = len([sid for sid, avg in subject_avg.items() if avg >= passing_mark])
                if passed_count < min_passed_subjects:
                    status = "Repeating"
                    notes = f"Passed {passed_count}/{min_passed_subjects} subjects"

        result = {
            "student_id": enrollment.student_id,
            "enrollment_id": enrollment.id,
            "section_id": enrollment.section_id,
            "student_name": student_name,
            "status": status,
            "failed_subject_ids": failed_subject_ids,
            "total_score": round(total_score, 2),
            "notes": notes,
        }
        # Only a real decision is saved; "Not graded" is re-evaluated once marks exist
        if status != NOT_GRADED:
            await PromotionStatusService(tenant=self.tenant_id, db=self.db).upsert_status_from_eval(result)
        return result

    async def apply_manual_scaling(self, enrollment_id: UUID, scaling_points: float, notes: Optional[str] = None) -> Dict[str, Any]:
        """Apply manual grace marks/scaling to a student's evaluation."""
        from src.services.academics.promotion_status_service import PromotionStatusService
        
        status_service = PromotionStatusService(tenant=self.tenant_id, db=self.db)
        ps = status_service.get_by_enrollment(enrollment_id)
        if not ps:
            # Evaluate first if no status exists
            eval_res = await self.evaluate_eligibility(enrollment_id)
            ps = status_service.get_by_enrollment(enrollment_id)
            
        current_score = float(ps.total_score or 0)
        new_score = current_score + scaling_points
        
        # Re-check criteria with new score
        from src.services.academics.promotion_criteria_service import PromotionCriteriaService
        from src.db.models.academics.enrollment import Enrollment as EnrollmentModel
        
        enrollment = self.db.query(EnrollmentModel).filter(EnrollmentModel.id == ps.enrollment_id).first()
        grade_id = enrollment.grade_id if enrollment else None
        
        criteria_service = PromotionCriteriaService(tenant=self.tenant_id, db=self.db)
        criteria = criteria_service.get_by_year_and_grade(
            academic_year_id=ps.academic_year_id, grade_id=grade_id
        )
        from src.services.academics.results_service import pass_mark_for
        passing_mark = pass_mark_for(self.db, self.tenant_id, ps.academic_year_id, grade_id)

        new_status = ps.status
        if new_score >= passing_mark and ps.status in ["Repeating", "Conditional"]:
            new_status = "Eligible"
            
        update_data = {
            "total_score": str(round(new_score, 2)),
            "status": new_status,
            "notes": (ps.notes or "") + f" | Scaled by {scaling_points} points" + (f": {notes}" if notes else "")
        }
        
        ps_updated = status_service.update(id=ps.id, obj_in=update_data)
        return {
            "student_id": ps_updated.student_id,
            "old_score": current_score,
            "new_score": new_score,
            "new_status": new_status
        }

    async def _promote_to_next_grade(
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
            self.tenant_id,
            db_obj=current_enrollment,
            obj_in={"status": "completed", "is_active": False}
        )
        
        # Resolve normalized IDs for next-grade enrollment
        from src.services.academics.academic_year_service import AcademicYearService
        from src.services.academics.academic_grade_service import AcademicGradeService
        from src.services.academics.section_service import SectionService

        ay_service = AcademicYearService(tenant=self.tenant_id, db=self.db)
        ag_service = AcademicGradeService(tenant=self.tenant_id, db=self.db)
        sec_service = SectionService(tenant=self.tenant_id, db=self.db)

        ay_obj = ay_service.get_by_name(target_academic_year)
        if not ay_obj:
            return {"student_id": current_enrollment.student_id, "error": "Target academic year not found", "type": "error"}

        next_grade_obj = ag_service.get_by_name(next_grade)
        if not next_grade_obj:
            return {"student_id": current_enrollment.student_id, "error": "Next grade not found", "type": "error"}

        target_section_name = promotion_rules.get(str(current_enrollment.student_id)) if promotion_rules else current_enrollment.section_name
        target_section_obj = sec_service.get_by_name(target_section_name, next_grade_obj.id)
        if not target_section_obj:
            sections = sec_service.get_by_grade(next_grade_obj.id)
            target_section_obj = sections[0] if sections else None
        if not target_section_obj:
            return {"student_id": current_enrollment.student_id, "error": "Target section not found for next grade", "type": "error"}

        from src.schemas.academics.enrollment import EnrollmentCreate
        new_enrollment_data = EnrollmentCreate(
            student_id=current_enrollment.student_id,
            academic_year=target_academic_year,
            semester=1,
            grade=next_grade,
            section=target_section_obj.name,
            academic_year_id=ay_obj.id,
            grade_id=next_grade_obj.id,
            section_id=target_section_obj.id,
            enrollment_date=date.today(),
            status="active",
            is_active=True,
            semester_1_status="active",
            semester_2_status="pending",
            comments=f"Promoted from {current_grade} to {next_grade} on {date.today()}"
        )
        # The new enrollment's class is the next grade/section's class for that year (created
        # if missing) when it is flushed: see Enrollment sync_enrollment_classes.
        new_enrollment = enrollment_crud.create(self.db, tenant_id=self.tenant_id, obj_in=new_enrollment_data)

        return {
            "student_id": current_enrollment.student_id,
            "from_grade": current_grade,
            "to_grade": next_grade,
            "from_academic_year": current_enrollment.academic_year,
            "to_academic_year": target_academic_year,
            "enrollment_id": new_enrollment.id,
            "type": "grade_promotion"
        }

    async def _graduate_student(self, current_enrollment) -> Dict[str, Any]:
        """Graduate student from the system."""
        enrollment_crud.update(
            self.db,
            self.tenant_id,
            db_obj=current_enrollment,
            obj_in={"status": "graduated", "is_active": False}
        )
        return {
            "student_id": current_enrollment.student_id,
            "type": "graduation",
            "academic_year": current_enrollment.academic_year,
            "grade": current_enrollment.grade_name if hasattr(current_enrollment, 'grade_name') else current_enrollment.grade
        }

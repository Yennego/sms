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

    def _own_year(self, year_id: UUID):
        from src.db.models.academics.academic_year import AcademicYear
        return self.db.query(AcademicYear).filter(
            AcademicYear.tenant_id == self.tenant_id, AcademicYear.id == year_id
        ).first()

    def _grades_in_order(self) -> list:
        return sorted(academic_grade_crud.get_active_grades(self.db, tenant_id=self.tenant_id),
                      key=lambda g: g.sequence)

    async def process_year_end_transition(
        self, current_year_id: UUID, target_year_name: str, grade_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Year-end transition (one grade level, or all): passing students move to the next grade
        level in the target year; students who stay in their grade (Repeating, Conditional) get
        remedial sessions and a class of the same grade in the target year; students without
        published results are skipped. Final-grade students who passed are left for Graduation."""
        from src.db.models.academics.enrollment import Enrollment as EnrollmentModel
        from src.db.models.academics.remedial_session import RemedialSession

        current = self._own_year(current_year_id)
        target = academic_year_crud.get_by_name(self.db, tenant_id=self.tenant_id, name=target_year_name)
        if not current or not target:
            raise BusinessRuleViolationError("School year not found")
        if target.start_date <= current.start_date:
            raise BusinessRuleViolationError("Choose a school year that starts after the one you are promoting from")

        results = {"promoted": [], "remedial": [], "graduating": [], "skipped": [], "errors": []}
        billed_ids = []  # newly in a class in the target year

        query = self.db.query(EnrollmentModel).filter(
            EnrollmentModel.tenant_id == self.tenant_id,
            EnrollmentModel.academic_year_id == current.id,
            EnrollmentModel.is_active == True,  # noqa: E712
            EnrollmentModel.status == "active",
        )
        if grade_id:
            query = query.filter(EnrollmentModel.grade_id == grade_id)
        enrollments = query.all()

        grades = self._grades_in_order()
        final_grade_id = grades[-1].id if grades else None

        for en in enrollments:
            eval_res = await self.evaluate_eligibility(en.id)
            # A Conditional student who already passed remedial work in every failed subject moves up
            if eval_res["status"] == "Conditional" and self._remedial_cleared(en.id, eval_res.get("failed_subject_ids", [])):
                eval_res = {**eval_res, "status": "Eligible"}
            if eval_res["status"] == NOT_GRADED:
                results["skipped"].append({"student_id": en.student_id, "reason": eval_res["notes"]})
            elif eval_res["status"] == "Eligible" and en.grade_id == final_grade_id:
                # Graduation is its own step (Graduation page), never done here
                results["graduating"].append({"student_id": en.student_id})
            elif eval_res["status"] == "Eligible":
                promo_res = await self._promote_to_next_grade(en, target, grades)
                if promo_res["type"] == "error":
                    results["errors"].append(promo_res)
                else:
                    results["promoted"].append(promo_res)
                    billed_ids.append(en.student_id)
            else:
                # Repeating/Conditional: the promotion rules keep them in their grade. Remedial
                # sessions in this year, and the same grade's class in the target year. Running the
                # transition again doesn't book the same session twice.
                booked = {sid for (sid,) in self.db.query(RemedialSession.subject_id).filter(
                    RemedialSession.tenant_id == self.tenant_id, RemedialSession.enrollment_id == en.id)}
                for subject_id in eval_res.get("failed_subject_ids", []):
                    if subject_id in booked:
                        continue
                    self.db.add(RemedialSession(
                        tenant_id=self.tenant_id, student_id=en.student_id, enrollment_id=en.id,
                        subject_id=subject_id, academic_year_id=current.id, scheduled_date=date.today(),
                    ))
                self.db.flush()
                placed = self._repeat_grade(en, target)
                if placed["type"] == "error":
                    results["errors"].append(placed)
                    continue
                billed_ids.append(en.student_id)
                results["remedial"].append({
                    "student_id": en.student_id,
                    "status": eval_res["status"],
                    "failed_subjects": len(eval_res.get("failed_subject_ids", [])),
                    "class_id": placed["class_id"],
                    "class_name": placed["class_name"],
                })

        # Billed like their new classmates when the target year already has invoices issued
        from src.services.finance.fee_service import FeeService
        FeeService(self.db, self.tenant_id, None).bill_new_enrollment(billed_ids, target.id)
        return results

    def _remedial_cleared(self, enrollment_id, failed_subject_ids) -> bool:
        """Every failed subject has a remedial session recorded as passed."""
        from src.db.models.academics.remedial_session import RemedialSession
        if not failed_subject_ids:
            return False
        passed = {sid for (sid,) in self.db.query(RemedialSession.subject_id).filter(
            RemedialSession.tenant_id == self.tenant_id, RemedialSession.enrollment_id == enrollment_id,
            RemedialSession.passed == True,  # noqa: E712
        )}
        return all(sid in passed for sid in failed_subject_ids)

    async def apply_remedial_outcome(self, enrollment_id: UUID) -> Optional[Dict[str, Any]]:
        """After a remedial result is recorded: a Conditional student who has now passed remedial
        work in every failed subject, and who was already placed again in the same grade for the
        next school year, moves up to the next grade's class in that year (same section when there
        is one, else the class with the most free places). Their unpaid bills there are re-priced
        for the new grade. Returns what happened, or None when nothing moves."""
        from sqlalchemy import func
        from src.db.models.academics.academic_year import AcademicYear
        from src.db.models.academics.class_model import Class
        from src.db.models.academics.enrollment import Enrollment as EnrollmentModel

        old = self.db.query(EnrollmentModel).filter(
            EnrollmentModel.tenant_id == self.tenant_id, EnrollmentModel.id == enrollment_id).first()
        if old is None:
            return None
        evaluation = await self.evaluate_eligibility(old.id)
        if evaluation["status"] != "Conditional" or not self._remedial_cleared(old.id, evaluation.get("failed_subject_ids", [])):
            return None
        old_year = self.db.query(AcademicYear).filter(AcademicYear.id == old.academic_year_id).first()
        # Their place in a later school year, still in the grade they were held back in
        repeat = (self.db.query(EnrollmentModel)
                  .join(AcademicYear, AcademicYear.id == EnrollmentModel.academic_year_id)
                  .filter(EnrollmentModel.tenant_id == self.tenant_id, EnrollmentModel.student_id == old.student_id,
                          EnrollmentModel.grade_id == old.grade_id, EnrollmentModel.status == "active",
                          AcademicYear.start_date > old_year.start_date)
                  .order_by(AcademicYear.start_date).first())
        if repeat is None:
            return None  # not placed again yet: the year-end transition promotes them instead
        grades = self._grades_in_order()
        current_grade = next((g for g in grades if g.id == old.grade_id), None)
        next_grade = next((g for g in grades if current_grade and g.sequence > current_grade.sequence), None)
        if next_grade is None:
            return None  # final grade: graduation is its own step

        classes = self.db.query(Class).filter(
            Class.tenant_id == self.tenant_id, Class.academic_year_id == repeat.academic_year_id,
            Class.grade_id == next_grade.id,
        ).all()
        section_name = repeat.section_obj.name if repeat.section_obj else None
        klass = next((c for c in classes if c.section is not None and c.section.name == section_name), None)
        if klass is None and classes:
            enrolled = dict(self.db.query(EnrollmentModel.class_id, func.count(EnrollmentModel.id)).filter(
                EnrollmentModel.tenant_id == self.tenant_id, EnrollmentModel.class_id.in_([c.id for c in classes]),
                EnrollmentModel.status == "active",
            ).group_by(EnrollmentModel.class_id).all())
            klass = max(classes, key=lambda c: ((c.capacity or 0) - enrolled.get(c.id, 0), c.name or ""))
        if klass is None:
            return {"student_id": old.student_id, "type": "error",
                    "error": f"No {next_grade.name} class in that school year. Create it in the year setup."}

        repeat.class_id = klass.id
        repeat.grade_id, repeat.section_id = klass.grade_id, klass.section_id
        repeat.comments = f"Moved up to {next_grade.name} after passing remedial work ({date.today()})"
        self.db.flush()
        from src.services.finance.fee_service import FeeService
        fees = FeeService(self.db, self.tenant_id, None).reprice_after_grade_change(
            old.student_id, repeat.academic_year_id, next_grade.id)
        return {"student_id": old.student_id, "type": "moved_up", "to_grade": next_grade.name,
                "class_id": klass.id, "class_name": klass.name, "fees_need_review": fees["needs_review"]}

    def _repeat_grade(self, current_enrollment, target_year) -> Dict[str, Any]:
        """Enroll a student who stays in their grade in that grade's class in target_year: the same
        section's class when there is one, else the grade's class with the most free places. The
        old enrollment is kept as history (status "completed")."""
        from sqlalchemy import func
        from src.db.models.academics.class_model import Class
        from src.db.models.academics.enrollment import Enrollment as EnrollmentModel

        def error(message: str) -> Dict[str, Any]:
            return {"student_id": current_enrollment.student_id, "error": message, "type": "error"}

        if self.db.query(EnrollmentModel.id).filter(
            EnrollmentModel.tenant_id == self.tenant_id,
            EnrollmentModel.student_id == current_enrollment.student_id,
            EnrollmentModel.academic_year_id == target_year.id,
        ).first():
            return error(f"Already has a class in {target_year.name}")
        classes = self.db.query(Class).filter(
            Class.tenant_id == self.tenant_id, Class.academic_year_id == target_year.id,
            Class.grade_id == current_enrollment.grade_id,
        ).all()
        klass = next((c for c in classes if c.section_id == current_enrollment.section_id), None)
        if klass is None and classes:
            enrolled = dict(self.db.query(EnrollmentModel.class_id, func.count(EnrollmentModel.id)).filter(
                EnrollmentModel.tenant_id == self.tenant_id,
                EnrollmentModel.class_id.in_([c.id for c in classes]),
                EnrollmentModel.status == "active",
            ).group_by(EnrollmentModel.class_id).all())
            klass = max(classes, key=lambda c: ((c.capacity or 0) - enrolled.get(c.id, 0), c.name or ""))
        if klass is None:
            return error(f"No {current_enrollment.grade_name} class in {target_year.name}. Create it in the year setup.")

        current_enrollment.status = "completed"
        current_enrollment.is_active = False
        new_enrollment = EnrollmentModel(
            tenant_id=self.tenant_id, student_id=current_enrollment.student_id, academic_year_id=target_year.id,
            class_id=klass.id, grade_id=klass.grade_id, section_id=klass.section_id,
            semester=1, enrollment_date=date.today(), status="active", is_active=True,
            comments=f"Repeats {current_enrollment.grade_name} (year-end transition on {date.today()})",
        )
        self.db.add(new_enrollment)
        self.db.flush()
        return {"student_id": current_enrollment.student_id, "enrollment_id": new_enrollment.id,
                "class_id": klass.id, "class_name": klass.name, "type": "repeat"}

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
        
        grades = self._grades_in_order()
        target_year = academic_year_crud.get_by_name(
            self.db, tenant_id=self.tenant_id, name=target_academic_year
        ) if target_academic_year else None

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
                    if target_year is None:
                        result = {"student_id": student_id, "error": "Target school year not found", "type": "error"}
                    else:
                        result = await self._promote_to_next_grade(
                            current_enrollment, target_year, grades, promotion_rules
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
        target_year,
        grades: list,
        promotion_rules: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Promote a student to the next grade level in target_year (an AcademicYear).

        Everything is checked before anything changes: on an error the current enrollment stays
        active. The old enrollment is kept as history (status "completed")."""
        from src.db.models.academics.enrollment import Enrollment as EnrollmentModel
        from src.db.models.academics.section import Section

        def error(message: str) -> Dict[str, Any]:
            return {"student_id": current_enrollment.student_id, "error": message, "type": "error"}

        current_grade = next((g for g in grades if g.id == current_enrollment.grade_id), None)
        if current_grade is None:
            return error("Current grade level not found")
        next_grade = next((g for g in grades if g.sequence > current_grade.sequence), None)
        if next_grade is None:
            return await self._graduate_student(current_enrollment)
        if self.db.query(EnrollmentModel.id).filter(
            EnrollmentModel.tenant_id == self.tenant_id,
            EnrollmentModel.student_id == current_enrollment.student_id,
            EnrollmentModel.academic_year_id == target_year.id,
        ).first():
            return error(f"Already has a class in {target_year.name}")

        # Same section name in the next grade level if it has one (or the one the rules name),
        # else its first section
        sections = self.db.query(Section).filter(
            Section.tenant_id == self.tenant_id, Section.grade_id == next_grade.id,
            Section.is_active == True,  # noqa: E712
        ).order_by(Section.name).all()
        wanted = (promotion_rules or {}).get(str(current_enrollment.student_id)) or current_enrollment.section_name
        target_section = next((x for x in sections if x.name == wanted), sections[0] if sections else None)
        if target_section is None:
            return error(f"{next_grade.name} has no sections")

        current_enrollment.status = "completed"
        current_enrollment.is_active = False
        # The new enrollment's class is the next grade/section's class for that year (created
        # if missing) when it is flushed: see Enrollment sync_enrollment_classes.
        new_enrollment = EnrollmentModel(
            tenant_id=self.tenant_id, student_id=current_enrollment.student_id,
            academic_year_id=target_year.id, grade_id=next_grade.id, section_id=target_section.id,
            semester=1, enrollment_date=date.today(), status="active", is_active=True,
            comments=f"Promoted from {current_grade.name} to {next_grade.name} on {date.today()}",
        )
        self.db.add(new_enrollment)
        self.db.flush()

        return {
            "student_id": current_enrollment.student_id,
            "from_grade": current_grade.name,
            "to_grade": next_grade.name,
            "from_academic_year": current_enrollment.academic_year_obj.name if current_enrollment.academic_year_obj else None,
            "to_academic_year": target_year.name,
            "enrollment_id": new_enrollment.id,
            "class_id": new_enrollment.class_id,
            "type": "grade_promotion"
        }

    async def _graduate_student(self, current_enrollment) -> Dict[str, Any]:
        """Graduate student from the system (as GraduationService.graduate does)."""
        current_enrollment.status = "graduated"
        current_enrollment.is_active = False
        current_enrollment.withdrawal_date = current_enrollment.withdrawal_date or date.today()
        if current_enrollment.student is not None:
            current_enrollment.student.graduate(date.today())
        self.db.flush()
        return {
            "student_id": current_enrollment.student_id,
            "type": "graduation",
            "academic_year": current_enrollment.academic_year,
            "grade": current_enrollment.grade_name if hasattr(current_enrollment, 'grade_name') else current_enrollment.grade
        }

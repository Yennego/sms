from typing import Any, Dict
import uuid
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, case
from datetime import date

from src.db.models.academics.academic_year import AcademicYear
from src.db.models.academics.academic_grade import AcademicGrade
from src.db.models.academics.section import Section
from src.db.models.academics.subject import Subject
from src.db.models.academics.class_model import Class
from src.db.models.academics.enrollment import Enrollment
from src.db.models.academics.exam import Exam
from src.db.models.academics.class_enrollment import ClassEnrollment
from src.db.models.academics.class_subject import ClassSubject
from src.db.models.academics.assignment import Assignment
from src.db.models.academics.submission import Submission
from src.db.models.academics.assessment import Assessment
from src.db.models.academics.attendance import Attendance
from src.db.models.academics.grade import Grade
from src.db.models.people.student import Student
from src.db.models.people.teacher import Teacher
from src.schemas.academics.dashboard import AcademicDashboardStats
from src.utils.uuid_utils import ensure_uuid

class AcademicDashboardService:
    def __init__(self, db: Session, tenant_id: Any, current_user: Any = None):
        self.db = db
        self.tenant_id = ensure_uuid(tenant_id)
        self.current_user = current_user

    async def get_stats(self) -> AcademicDashboardStats:
        """Fetch all dashboard stats based on the current user's role."""
        # 1. Base counts (existing logic)
        from sqlalchemy import text
        sql = text("""
            SELECT 
                (SELECT count(s.id) FROM students s JOIN users u ON s.id = u.id WHERE u.tenant_id = :tid AND s.status = 'active') as total_students,
                (SELECT count(t.id) FROM teachers t JOIN users u ON t.id = u.id WHERE u.tenant_id = :tid AND t.status = 'active') as total_teachers,
                (SELECT count(id) FROM classes WHERE tenant_id = :tid AND is_active = true) as total_classes,
                (SELECT count(id) FROM subjects WHERE tenant_id = :tid AND is_active = true) as total_subjects,
                (SELECT count(id) FROM academic_grades WHERE tenant_id = :tid AND is_active = true) as total_grades,
                (SELECT count(id) FROM sections WHERE tenant_id = :tid AND is_active = true) as total_sections
        """)
        
        counts = self.db.execute(sql, {"tid": self.tenant_id}).mappings().first()
        
        stats_dict = {
            "total_students": counts["total_students"] or 0,
            "total_teachers": counts["total_teachers"] or 0,
            "total_classes": counts["total_classes"] or 0,
            "total_subjects": counts["total_subjects"] or 0,
            "total_grades": counts["total_grades"] or 0,
            "total_sections": counts["total_sections"] or 0,
        }

        # 2. Current Academic Year
        current_year = self.db.query(AcademicYear).filter(
            AcademicYear.tenant_id == self.tenant_id,
            AcademicYear.is_current == True
        ).first()
        
        stats_dict["active_academic_year"] = current_year.name if current_year else "Not Set"

        # 3. Completion Score (simplified for brevity)
        config_items = [
            current_year is not None,
            stats_dict["total_grades"] > 0,
            stats_dict["total_teachers"] > 0,
            stats_dict["total_students"] > 0
        ]
        stats_dict["configuration_score"] = int((sum(config_items) / len(config_items)) * 100)

        # 4. Role-Specific Stats
        if self.current_user:
            role = getattr(self.current_user, "role", None)
            if role == "student":
                from src.db.models.people.student import Student
                student = self.db.query(Student).filter(Student.id == self.current_user.id).first()
                if student:
                    stats_dict["student_stats"] = await self._get_student_dashboard_stats()
            elif role == "teacher":
                stats_dict["teacher_stats"] = await self._get_teacher_dashboard_stats(self.current_user.id)

        return AcademicDashboardStats(**stats_dict)

    async def _get_student_dashboard_stats(self) -> Dict[str, Any]:
        print(f"DEBUG: Calculating stats for Student/User ID: {self.current_user.id} in Tenant: {self.tenant_id}")
        student = self.db.query(Student).filter(Student.id == self.current_user.id).first()
        if not student:
            print(f"DEBUG: Student record NOT FOUND for user {self.current_user.id}")
            return {"gpa": 0.0, "active_courses": 0, "pending_tasks": 0, "attendance_percentage": 0}
        
        student_id = student.id
        print(f"DEBUG: Found Student record: {student.admission_number}")

        # Get active enrollment and grade
        active_enrollment = self.db.query(Enrollment).filter(
            Enrollment.student_id == student_id,
            Enrollment.status.in_(["active", "enrolled", "promotion_pending"]),
            Enrollment.is_active == True,
            Enrollment.tenant_id == self.tenant_id
        ).first()

        if not active_enrollment:
            print(f"DEBUG: Active enrollment NOT FOUND for student {student_id}")
        else:
            print(f"DEBUG: Found active enrollment: {active_enrollment.id}, Status: {active_enrollment.status}, Grade ID: {active_enrollment.grade_id}")

        # 1. GPA Calculation
        # Use Grade model (src.db.models.academics.grade)
        assessment_grades = self.db.query(Grade).filter(
            Grade.student_id == student_id,
            Grade.tenant_id == self.tenant_id
        ).all()
        
        valid_grades = [g for g in assessment_grades if g.percentage is not None]
        gpa_raw = sum(g.percentage for g in valid_grades) / len(valid_grades) if valid_grades else 0.0
        gpa = round((gpa_raw / 100) * 4.0, 1) # Simple 4.0 scale

        # 2. Active Courses
        # Count ClassSubjects for classes matching the student's enrollment grade/section
        active_courses = 0
        if active_enrollment and active_enrollment.grade_id:
            from src.db.models.academics.class_model import Class
            # Find classes matching the student's grade + section + academic year
            class_filter = [
                Class.grade_id == active_enrollment.grade_id,
                Class.tenant_id == self.tenant_id,
                Class.is_active == True
            ]
            if active_enrollment.section_id:
                class_filter.append(Class.section_id == active_enrollment.section_id)
            if active_enrollment.academic_year_id:
                class_filter.append(Class.academic_year_id == active_enrollment.academic_year_id)
            
            matching_class_ids = [c[0] for c in self.db.query(Class.id).filter(*class_filter).all()]
            
            if matching_class_ids:
                active_courses = self.db.query(func.count(ClassSubject.id)).filter(
                    ClassSubject.class_id.in_(matching_class_ids),
                    ClassSubject.tenant_id == self.tenant_id
                ).scalar() or 0
        
        # Fallback: at least 1 if enrolled
        if active_courses == 0 and active_enrollment:
            active_courses = 1

        # 3. Pending Tasks
        pending_tasks = 0
        if active_enrollment and active_enrollment.grade_id:
            # A. Assignments
            # Published assignments for student's grade that haven't been submitted
            all_assignments = self.db.query(Assignment).filter(
                Assignment.grade_id == active_enrollment.grade_id,
                Assignment.is_published == True,
                Assignment.tenant_id == self.tenant_id
            ).all()
            
            # Submissions by this student
            submitted_ids = self.db.query(Submission.assignment_id).filter(
                Submission.student_id == student_id,
                Submission.tenant_id == self.tenant_id
            ).all()
            submitted_ids = {s[0] for s in submitted_ids}
            
            p_assignments = len([a for a in all_assignments if a.id not in submitted_ids])
            pending_tasks += p_assignments

            # B. Assessments (Quizzes, Tests, Projects, etc.)
            # Non-assignment assessments that are published and not yet graded for this student
            all_assessments = self.db.query(Assessment).filter(
                Assessment.grade_id == active_enrollment.grade_id,
                Assessment.is_published == True,
                Assessment.tenant_id == self.tenant_id
            ).all()

            # Get assessment_ids that already have grades for this student
            from src.db.models.academics.grade import GradeType
            assessment_ids_with_grades = self.db.query(Grade.assessment_id).filter(
                Grade.student_id == student_id,
                Grade.assessment_type.in_([
                    GradeType.QUIZ, GradeType.TEST, GradeType.PROJECT, 
                    GradeType.PARTICIPATION, GradeType.OTHER
                ]),
                Grade.tenant_id == self.tenant_id
            ).all()
            assessment_ids_with_grades = {g[0] for g in assessment_ids_with_grades}
            
            pending_tasks += len([a for a in all_assessments if a.id not in assessment_ids_with_grades])

            # C. Exams
            all_exams = self.db.query(Exam).filter(
                Exam.grade_id == active_enrollment.grade_id,
                Exam.is_published == True,
                Exam.tenant_id == self.tenant_id
            ).all()

            exam_ids_with_grades = self.db.query(Grade.assessment_id).filter(
                Grade.student_id == student_id,
                Grade.assessment_type == GradeType.EXAM,
                Grade.tenant_id == self.tenant_id
            ).all()
            exam_ids_with_grades = {g[0] for g in exam_ids_with_grades}

            pending_tasks += len([e for e in all_exams if e.id not in exam_ids_with_grades])

        # 4. Attendance Rate
        from src.db.models.academics.attendance import AttendanceStatus
        attendance_stats = self.db.query(
            func.count(Attendance.id),
            func.sum(case((Attendance.status == AttendanceStatus.PRESENT, 1), else_=0))
        ).filter(
            Attendance.student_id == student_id,
            Attendance.tenant_id == self.tenant_id
        ).first()
        
        att_total = attendance_stats[0] or 0
        att_present = attendance_stats[1] or 0
        att_rate = (att_present / att_total * 100) if att_total > 0 else 0.0

        return {
            "gpa": gpa,
            "active_courses": active_courses,
            "pending_tasks": pending_tasks,
            "attendance_percentage": round(att_rate, 1)
        }

    async def _get_teacher_dashboard_stats(self, teacher_id: uuid.UUID) -> Dict[str, Any]:
        """Calculate dynamic stats for the teacher dashboard."""
        from src.db.models.academics.class_model import Class
        from src.db.models.academics.class_subject import ClassSubject
        from src.db.models.academics.submission import Submission, SubmissionStatus
        from src.db.models.academics.assignment import Assignment
        from src.db.models.academics.class_enrollment import ClassEnrollment

        # 1. Assigned Classes (Teacher can be a Subject Teacher OR a Class Sponsor)
        # Get IDs of classes where teacher is assigned via ClassSubject
        subject_class_ids = self.db.query(ClassSubject.class_id).filter(
            ClassSubject.teacher_id == teacher_id,
            ClassSubject.tenant_id == self.tenant_id
        ).all()
        subject_class_ids = [r[0] for r in subject_class_ids]

        # Get IDs of classes where teacher is the Sponsor (class_teacher_id)
        sponsored_class_ids = self.db.query(Class.id).filter(
            Class.class_teacher_id == teacher_id,
            Class.tenant_id == self.tenant_id,
            Class.is_active == True
        ).all()
        sponsored_class_ids = [r[0] for r in sponsored_class_ids]

        # Combine unique class IDs
        all_class_ids = list(set(subject_class_ids + sponsored_class_ids))
        assigned_classes_count = len(all_class_ids)

        # 2. Total Students (Unique across all assigned classes)
        # We query the Enrollment table based on Grade, Section, and Year that match the assigned classes.
        # This is because students are enrolled in Grades/Sections, and Classes represent those units.
        from src.db.models.academics.enrollment import Enrollment
        from sqlalchemy import and_

        total_students = 0
        if all_class_ids:
            total_students = self.db.query(func.count(func.distinct(Enrollment.student_id))).join(
                Class, and_(
                    Class.grade_id == Enrollment.grade_id,
                    Class.section_id == Enrollment.section_id,
                    Class.academic_year_id == Enrollment.academic_year_id,
                    Class.tenant_id == Enrollment.tenant_id
                )
            ).filter(
                Class.id.in_(all_class_ids),
                Enrollment.status == "active",
                Enrollment.tenant_id == self.tenant_id
            ).scalar() or 0

        # 3. Pending Grades
        # Count submissions for teacher's assignments that are not yet graded
        pending_grades = self.db.query(func.count(Submission.id)).join(Assignment).filter(
            Assignment.teacher_id == teacher_id,
            Assignment.tenant_id == self.tenant_id,
            Submission.status == SubmissionStatus.SUBMITTED
        ).scalar() or 0

        # 4. Active Assignments
        active_assignments = self.db.query(func.count(Assignment.id)).filter(
            Assignment.teacher_id == teacher_id,
            Assignment.tenant_id == self.tenant_id,
            Assignment.is_published == True,
            Assignment.due_date >= date.today()
        ).scalar() or 0

        return {
            "assigned_classes": assigned_classes_count,
            "total_students": total_students,
            "pending_grades": pending_grades,
            "active_assignments": active_assignments
        }

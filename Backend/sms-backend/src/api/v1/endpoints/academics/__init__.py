from fastapi import APIRouter

from src.api.v1.endpoints.academics import (
    class_api,
    subject_api,
    section_api,
    academic_grade_api,
    academic_year_api,
    exam,
    enrollment,
    schedule_api,
    timetable_api,
    attendance_api,
    class_enrollment,
    promotion as promotion_api,
    remedial as remedial_api,
    assignment,
    grade as grade_api,
    teacher_assignment,
    semester_api,
    period_api,
    assessment,
    setup_api,
    dashboard_api,
    grading_api,
    submissions
)

router = APIRouter()

# Include all academic routers
router.include_router(class_api.router, tags=["classes"])
router.include_router(subject_api.router, tags=["subjects"])
router.include_router(section_api.router, tags=["sections"])
router.include_router(academic_grade_api.router, tags=["academic-grades"])
router.include_router(academic_year_api.router, tags=["academic-years"])
router.include_router(exam.router, tags=["exams"])
router.include_router(enrollment.router, tags=["enrollments"])
router.include_router(schedule_api.router, tags=["schedules"])
router.include_router(timetable_api.router, tags=["timetables"])
router.include_router(attendance_api.router, tags=["attendance"])
router.include_router(class_enrollment.router, tags=["class-enrollments"])  # mount class enrollment routes
router.include_router(promotion_api.router, tags=["promotions"])
router.include_router(remedial_api.router, tags=["remedial"])
router.include_router(assignment.router, tags=["assignments"])  # NEW
router.include_router(grade_api.router, tags=["grades"])  # NEW
router.include_router(promotion_api.alias_router, tags=["promotions"])  # NEW alias include
router.include_router(teacher_assignment.router, prefix="/teacher-subject-assignments", tags=["teacher-assignments"])  # NEW
router.include_router(semester_api.router, tags=["semesters"])
router.include_router(period_api.router, tags=["periods"])
router.include_router(assessment.router, tags=["assessments"])
router.include_router(setup_api.router, tags=["setup"])
router.include_router(dashboard_api.router, prefix="/dashboard", tags=["Dashboard"])
router.include_router(grading_api.router, tags=["grading"])
router.include_router(submissions.router, prefix="/submissions", tags=["submissions"])

# Export individual routers for reference
class_router = class_api.router
subject_router = subject_api.router
section_router = section_api.router
academic_grade_router = academic_grade_api.router
academic_year_router = academic_year_api.router
exam_router = exam.router
enrollment_router = enrollment.router
schedule_router = schedule_api.router
timetable_router = timetable_api.router
attendance_router = attendance_api.router
grade_router = grade_api.router

__all__ = ["router"]
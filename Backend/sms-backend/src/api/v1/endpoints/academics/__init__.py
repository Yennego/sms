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
    attendance_api
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

__all__ = ["router"]
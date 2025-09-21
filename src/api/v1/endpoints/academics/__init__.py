from fastapi import APIRouter

from src.api.v1.endpoints.academics.exam import router as exam_router
from src.api.v1.endpoints.academics.class_api import router as class_router
from src.api.v1.endpoints.academics.schedule_api import router as schedule_router
from src.api.v1.endpoints.academics.timetable_api import router as timetable_router
from src.api.v1.endpoints.academics.academic_year_api import router as academic_year_router

router = APIRouter()
router.include_router(exam_router, tags=["exams"])
router.include_router(class_router, tags=["classes"])
router.include_router(schedule_router, tags=["schedules"])
router.include_router(timetable_router, tags=["timetables"])
router.include_router(academic_year_router, prefix="/academic-years", tags=["academic-years"])

__all__ = ["router"]
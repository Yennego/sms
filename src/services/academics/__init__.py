# from .enrollment import EnrollmentService, SuperAdminEnrollmentService
# Import service modules to make them available from the package
from src.services.academics.enrollment import EnrollmentService, SuperAdminEnrollmentService
from src.services.academics.assignment import AssignmentService, SuperAdminAssignmentService
from src.services.academics.exam import ExamService, SuperAdminExamService
from src.services.academics.grade_calculation import GradeCalculationService
from src.services.academics.class_service import ClassService, SuperAdminClassService
from src.services.academics.schedule_service import ScheduleService, SuperAdminScheduleService
from src.services.academics.timetable_service import TimetableService, SuperAdminTimetableService
from .grade_calculation import GradeCalculationService, SuperAdminGradeCalculationService
from .assignment import AssignmentService, SuperAdminAssignmentService
from .exam import ExamService, SuperAdminExamService

__all__ = [
    "EnrollmentService",
    "SuperAdminEnrollmentService",
    "GradeCalculationService",
    "SuperAdminGradeCalculationService",
    "AssignmentService",
    "SuperAdminAssignmentService",
    "ExamService",
    "SuperAdminExamService"
]
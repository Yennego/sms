# Import service modules to make them available from the package
from src.services.academics.enrollment import EnrollmentService, SuperAdminEnrollmentService
from src.services.academics.assignment import AssignmentService, SuperAdminAssignmentService
from src.services.academics.class_service import ClassService, SuperAdminClassService
from src.services.academics.schedule_service import ScheduleService, SuperAdminScheduleService
from src.services.academics.timetable_service import TimetableService, SuperAdminTimetableService
from .attendance_service import AttendanceService, SuperAdminAttendanceService

__all__ = [
    "EnrollmentService",
    "SuperAdminEnrollmentService",
    "AssignmentService",
    "SuperAdminAssignmentService",
    "AttendanceService",
    "SuperAdminAttendanceService"
]

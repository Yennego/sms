from src.schemas.academics.academic_grade import AcademicGrade, AcademicGradeCreate, AcademicGradeUpdate, AcademicGradeInDB
from src.schemas.academics.assignment import Assignment, AssignmentCreate, AssignmentUpdate, AssignmentInDB, AssignmentWithDetails
from src.schemas.academics.class_schema import Class, ClassCreate, ClassUpdate, ClassInDB, ClassWithDetails
from src.schemas.academics.enrollment import Enrollment, EnrollmentCreate, EnrollmentUpdate, EnrollmentInDB
from src.schemas.academics.schedule import Schedule, ScheduleCreate, ScheduleUpdate, ScheduleInDB, ScheduleWithDetails
from src.schemas.academics.section import Section, SectionCreate, SectionUpdate, SectionInDB, SectionWithDetails
from src.schemas.academics.subject import Subject, SubjectCreate, SubjectUpdate, SubjectInDB
from src.schemas.academics.timetable import Timetable, TimetableCreate, TimetableUpdate, TimetableInDB, TimetableWithDetails
from src.schemas.academics.enrollment import (
    EnrollmentBase,
    EnrollmentCreate,
    EnrollmentUpdate,
    EnrollmentInDB,
    Enrollment,
    EnrollmentWithStudent
)

from src.schemas.academics.assignment import (
    AssignmentBase,
    AssignmentCreate,
    AssignmentUpdate,
    AssignmentInDB,
    Assignment,
    AssignmentWithDetails
)

from .attendance import (
    Attendance, AttendanceCreate, AttendanceUpdate, AttendanceWithDetails,
    AttendanceSummary, BulkAttendanceCreate, AttendanceReport
)
from src.schemas.academics.grading_schema import (
    GradingSchema, GradingSchemaCreate, GradingSchemaUpdate,
    GradingCategory, GradingCategoryCreate, GradingCategoryUpdate
)

__all__ = [
    "EnrollmentBase",
    "EnrollmentCreate",
    "EnrollmentUpdate",
    "EnrollmentInDB",
    "Enrollment",
    "EnrollmentWithStudent",
    "AssignmentBase",
    "AssignmentCreate",
    "AssignmentUpdate",
    "AssignmentInDB",
    "Assignment",
    "AssignmentWithDetails",
    "GradingSchema",
    "GradingSchemaCreate",
    "GradingSchemaUpdate",
    "GradingCategory",
    "GradingCategoryCreate",
    "GradingCategoryUpdate"
]
# Add the attendance schemas to the __all__ list

from src.schemas.academics.academic_grade import AcademicGrade, AcademicGradeCreate, AcademicGradeUpdate, AcademicGradeInDB
from src.schemas.academics.assignment import Assignment, AssignmentCreate, AssignmentUpdate, AssignmentInDB, AssignmentWithDetails
from src.schemas.academics.class_schema import Class, ClassCreate, ClassUpdate, ClassInDB, ClassWithDetails
from src.schemas.academics.enrollment import Enrollment, EnrollmentCreate, EnrollmentUpdate, EnrollmentInDB
from src.schemas.academics.exam import Exam, ExamCreate, ExamUpdate, ExamInDB, ExamWithDetails
from src.schemas.academics.grade import Grade, GradeCreate, GradeUpdate, GradeInDB, GradeWithDetails
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

from src.schemas.academics.grade import (
    GradeType,
    GradeBase,
    GradeCreate,
    GradeUpdate,
    GradeInDB,
    Grade,
    GradeWithDetails
)

from src.schemas.academics.assignment import (
    AssignmentBase,
    AssignmentCreate,
    AssignmentUpdate,
    AssignmentInDB,
    Assignment,
    AssignmentWithDetails
)

from src.schemas.academics.exam import (
    ExamBase,
    ExamCreate,
    ExamUpdate,
    ExamInDB,
    Exam,
    ExamWithDetails
)

__all__ = [
    "EnrollmentBase",
    "EnrollmentCreate",
    "EnrollmentUpdate",
    "EnrollmentInDB",
    "Enrollment",
    "EnrollmentWithStudent",
    "GradeType",
    "GradeBase",
    "GradeCreate",
    "GradeUpdate",
    "GradeInDB",
    "Grade",
    "GradeWithDetails",
    "AssignmentBase",
    "AssignmentCreate",
    "AssignmentUpdate",
    "AssignmentInDB",
    "Assignment",
    "AssignmentWithDetails",
    "ExamBase",
    "ExamCreate",
    "ExamUpdate",
    "ExamInDB",
    "Exam",
    "ExamWithDetails"
]
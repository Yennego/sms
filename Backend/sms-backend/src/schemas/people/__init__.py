from .student import Student, StudentCreate, StudentUpdate, StudentBulkDelete
from .teacher import Teacher, TeacherCreate, TeacherUpdate, TeacherCreateResponse
from .parent import Parent, ParentCreate, ParentUpdate

__all__ = [
    "Student", "StudentCreate", "StudentUpdate", "StudentBulkDelete",
    "Teacher", "TeacherCreate", "TeacherUpdate", "TeacherCreateResponse",
    "Parent", "ParentCreate", "ParentUpdate"
]


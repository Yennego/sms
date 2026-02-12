from typing import Optional
from pydantic import BaseModel
from uuid import UUID

class AcademicSetupStatus(BaseModel):
    academic_years: int
    grades: int
    sections: int
    subjects: int
    classes: int
    teachers: int
    students: int
    teacher_assignments: int
    student_enrollments: int
    semesters: int
    current_academic_year_id: Optional[UUID] = None
    current_academic_year_name: Optional[str] = None

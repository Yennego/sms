from pydantic import BaseModel, Field
from typing import Optional

class StudentDashboardStats(BaseModel):
    """Schema for student dashboard statistics."""
    gpa: float = Field(0.0, description="Estimated grade point average")
    active_courses: int = Field(0, description="Count of active course enrollments")
    pending_tasks: int = Field(0, description="Count of pending tasks (Assignments, Exams, Assessments)")
    attendance_percentage: float = Field(0.0, description="Overall attendance rate")

class TeacherDashboardStats(BaseModel):
    """Schema for teacher dashboard statistics."""
    assigned_classes: int = Field(0, description="Count of assigned classes")
    total_students: int = Field(0, description="Total unique students in assigned classes")
    pending_grades: int = Field(0, description="Count of submissions awaiting grading")
    active_assignments: int = Field(0, description="Count of live assignments")

class AcademicDashboardStats(BaseModel):
    """Schema for academic dashboard overview statistics."""
    total_students: int = Field(0, description="Total active students")
    total_teachers: int = Field(0, description="Total active teachers")
    total_classes: int = Field(0, description="Total active classes")
    total_subjects: int = Field(0, description="Total active subjects")
    total_grades: int = Field(0, description="Total active grades")
    total_sections: int = Field(0, description="Total active sections")
    active_academic_year: str = Field("Not Set", description="Name of the current academic year")
    assignment_completion: int = Field(0, description="Percentage of teachers assigned (0-100)")
    enrollment_completion: int = Field(0, description="Percentage of students enrolled (0-100)")
    configuration_score: int = Field(0, description="Overall system configuration percentage")
    
    # Optional role-specific stats
    student_stats: Optional[StudentDashboardStats] = None
    teacher_stats: Optional[TeacherDashboardStats] = None

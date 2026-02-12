from datetime import date, datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class ClassEnrollmentBase(BaseModel):
    student_id: UUID
    class_id: UUID
    academic_year_id: UUID
    enrollment_date: Optional[date] = None
    status: str = "active"
    is_active: bool = True
    drop_date: Optional[date] = None
    completion_date: Optional[date] = None


class ClassEnrollmentCreate(ClassEnrollmentBase):
    pass


class ClassEnrollmentUpdate(BaseModel):
    enrollment_date: Optional[date] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    drop_date: Optional[date] = None
    completion_date: Optional[date] = None


class ClassEnrollment(ClassEnrollmentBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClassEnrollmentWithDetails(ClassEnrollment):
    student_name: Optional[str] = None
    student_admission_number: Optional[str] = None
    class_name: Optional[str] = None
    academic_year_name: Optional[str] = None
    enrollment_id: Optional[UUID] = None


class BulkClassEnrollmentCreate(BaseModel):
    class_id: UUID
    academic_year_id: UUID
    student_ids: List[UUID]
    enrollment_date: Optional[date] = None
    status: str = "active"


class ClassEnrollmentSummary(BaseModel):
    total: int
    active: int
    dropped: int
    completed: int
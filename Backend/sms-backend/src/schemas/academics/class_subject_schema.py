from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from src.schemas.base.base import TenantSchema

class ClassSubjectBase(BaseModel):
    subject_id: UUID
    teacher_id: Optional[UUID] = None
    grading_schema_id: Optional[UUID] = None

class ClassSubjectCreate(ClassSubjectBase):
    pass

class ClassSubjectUpdate(BaseModel):
    teacher_id: Optional[UUID] = None
    grading_schema_id: Optional[UUID] = None

class ClassSubject(ClassSubjectBase, TenantSchema):
    id: UUID
    class_id: UUID
    
    # Detail fields for response
    subject_name: Optional[str] = None
    teacher_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class ClassSubjectWithDetails(ClassSubject):
    grade_id: Optional[UUID] = None
    section_id: Optional[UUID] = None
    academic_year_id: Optional[UUID] = None
    grade_name: Optional[str] = None
    section_name: Optional[str] = None
    academic_year: Optional[str] = None
    class_name: Optional[str] = None
    is_assigned: bool = True

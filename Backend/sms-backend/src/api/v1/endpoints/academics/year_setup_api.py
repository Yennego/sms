"""School-year setup wizard endpoints (docs/remodel/phase3-api.md §1)."""
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.core.auth.dependencies import has_permission
from src.core.middleware.tenant import get_tenant_id_from_request
from src.db.session import get_db
from src.services.academics.year_setup_service import YearSetupService

router = APIRouter(prefix="/year-setup", tags=["year-setup"])

CAN_SET_UP = Depends(has_permission("manage_academic_year"))


def _service(db: Session = Depends(get_db), tenant_id=Depends(get_tenant_id_from_request)) -> YearSetupService:
    return YearSetupService(db=db, tenant_id=tenant_id)


class CopyOptions(BaseModel):
    terms: bool = True
    classes: bool = True
    sponsors: bool = True
    subjects: bool = True


class GenerateClasses(BaseModel):
    grade_ids: Optional[List[UUID]] = None
    capacity: int = Field(30, ge=1, le=500)  # seats per new class; each class can be changed later


class TeacherChoice(BaseModel):
    teacher_id: Optional[UUID] = None


class AssignSubjects(BaseModel):
    grade_id: UUID
    subject_ids: List[UUID] = []
    teachers: Dict[UUID, UUID] = {}


@router.get("/{year_id}")
def get_year_setup(year_id: UUID, _=CAN_SET_UP, service: YearSetupService = Depends(_service)) -> Any:
    """Everything the wizard shows for one school year, with each step's completeness."""
    return service.overview(year_id)


@router.post("/{year_id}/terms/default")
def add_default_terms(year_id: UUID, _=CAN_SET_UP, service: YearSetupService = Depends(_service)) -> Any:
    """Add 2 semesters of 3 periods each, splitting the year's dates evenly."""
    return service.default_terms(year_id)


@router.post("/{year_id}/copy-from/{source_year_id}")
def copy_from_year(
    year_id: UUID, source_year_id: UUID, options: CopyOptions = Body(default_factory=CopyOptions),
    _=CAN_SET_UP, service: YearSetupService = Depends(_service),
) -> Any:
    """Copy what this year lacks from another year: terms, classes, sponsors, subjects."""
    return service.copy_from(year_id, source_year_id, **options.model_dump())


@router.post("/{year_id}/classes/generate")
def generate_classes(
    year_id: UUID, body: GenerateClasses = Body(default_factory=GenerateClasses),
    _=CAN_SET_UP, service: YearSetupService = Depends(_service),
) -> Any:
    """Create one class per grade level and section that has none this year."""
    return service.generate_classes(year_id, body.grade_ids, body.capacity)


@router.put("/classes/{class_id}/sponsor")
def set_class_sponsor(class_id: UUID, body: TeacherChoice, _=CAN_SET_UP, service: YearSetupService = Depends(_service)) -> Any:
    return service.set_sponsor(class_id, body.teacher_id)


@router.post("/{year_id}/subjects")
def assign_level_subjects(year_id: UUID, body: AssignSubjects, _=CAN_SET_UP, service: YearSetupService = Depends(_service)) -> Any:
    """Give every class of a grade level these subjects (and teachers)."""
    return service.assign_subjects(year_id, body.grade_id, body.subject_ids, body.teachers)


@router.put("/class-subjects/{class_subject_id}/teacher")
def set_subject_teacher(class_subject_id: UUID, body: TeacherChoice, _=CAN_SET_UP, service: YearSetupService = Depends(_service)) -> Any:
    return service.set_subject_teacher(class_subject_id, body.teacher_id)

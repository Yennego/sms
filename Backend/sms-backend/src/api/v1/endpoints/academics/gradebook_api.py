"""Gradebook API (docs/remodel/phase4-design.md §4): assessments, scores, publishing, report cards.

Access rules live in GradebookService (§3); every route needs a session (router default).
"""
from datetime import date
from typing import Any, List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.core.auth.dependencies import get_current_active_user
from src.core.middleware.tenant import get_tenant_id_from_request
from src.db.session import get_db
from src.services.academics.gradebook_service import GradebookService

router = APIRouter(prefix="/gradebook", tags=["gradebook"])

Kind = Literal["test", "quiz", "assignment", "project", "participation", "exam", "other"]


def _service(db: Session = Depends(get_db), tenant_id=Depends(get_tenant_id_from_request),
             user=Depends(get_current_active_user)) -> GradebookService:
    return GradebookService(db=db, tenant_id=tenant_id, user=user)


class AssessmentFields(BaseModel):
    kind: Kind
    period_id: Optional[UUID] = None
    semester_id: Optional[UUID] = None
    grading_category_id: Optional[UUID] = None
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    assessment_date: Optional[date] = None
    due_date: Optional[date] = None
    max_score: float = Field(gt=0)


class AssessmentCreate(AssessmentFields):
    class_subject_id: UUID


class ScoreIn(BaseModel):
    student_id: UUID
    score: Optional[float] = None
    status: Literal["scored", "absent", "excused"] = "scored"
    comment: Optional[str] = None


class ScoresIn(BaseModel):
    entries: List[ScoreIn] = Field(max_length=500)


class PublicationIn(BaseModel):
    class_id: UUID
    period_id: Optional[UUID] = None
    semester_id: Optional[UUID] = None


class SettingsIn(BaseModel):
    pass_mark: int = Field(ge=0, le=100)


@router.get("/class-subjects")
def list_class_subjects(academic_year_id: Optional[UUID] = None, service: GradebookService = Depends(_service)) -> Any:
    """Class subjects the user may open (staff: all; a teacher: taught + sponsored classes)."""
    return service.class_subjects(academic_year_id)


@router.get("/assessments")
def list_assessments(class_subject_id: UUID, period_id: Optional[UUID] = None, semester_id: Optional[UUID] = None,
                     service: GradebookService = Depends(_service)) -> Any:
    return service.list_assessments(class_subject_id, period_id, semester_id)


@router.post("/assessments", status_code=201)
def create_assessment(body: AssessmentCreate, service: GradebookService = Depends(_service)) -> Any:
    return service.create_assessment(body.model_dump())


@router.put("/assessments/{assessment_id}")
def update_assessment(assessment_id: UUID, body: AssessmentFields, service: GradebookService = Depends(_service)) -> Any:
    return service.update_assessment(assessment_id, body.model_dump())


@router.delete("/assessments/{assessment_id}")
def delete_assessment(assessment_id: UUID, force: bool = False, service: GradebookService = Depends(_service)) -> Any:
    return service.delete_assessment(assessment_id, force=force)


@router.get("/sheet")
def get_sheet(class_subject_id: UUID, period_id: Optional[UUID] = None, semester_id: Optional[UUID] = None,
              service: GradebookService = Depends(_service)) -> Any:
    return service.sheet(class_subject_id, period_id, semester_id)


@router.put("/assessments/{assessment_id}/scores")
def save_scores(assessment_id: UUID, body: ScoresIn, service: GradebookService = Depends(_service)) -> Any:
    """Upsert scores, all or nothing. {score: null, status: "scored"} clears a student's mark."""
    return service.save_scores(assessment_id, [e.model_dump() for e in body.entries])


@router.get("/classes/{class_id}/progress")
def class_progress(class_id: UUID, period_id: Optional[UUID] = None, semester_id: Optional[UUID] = None,
                   service: GradebookService = Depends(_service)) -> Any:
    return service.progress(class_id, period_id, semester_id)


@router.get("/publications")
def list_publications(academic_year_id: Optional[UUID] = None, service: GradebookService = Depends(_service)) -> Any:
    return service.publications(academic_year_id)


@router.post("/publications", status_code=201)
def publish(body: PublicationIn, service: GradebookService = Depends(_service)) -> Any:
    return service.publish(body.class_id, body.period_id, body.semester_id)


@router.delete("/publications")
def unpublish(class_id: UUID = Query(...), period_id: Optional[UUID] = None, semester_id: Optional[UUID] = None,
              service: GradebookService = Depends(_service)) -> Any:
    return service.unpublish(class_id, period_id, semester_id)


@router.get("/report-cards/students/{student_id}")
def student_report_card(student_id: UUID, academic_year_id: Optional[UUID] = None,
                        service: GradebookService = Depends(_service)) -> Any:
    return service.student_report_card(student_id, academic_year_id)


@router.get("/report-cards/classes/{class_id}")
def class_report_cards(class_id: UUID, academic_year_id: Optional[UUID] = None,
                       service: GradebookService = Depends(_service)) -> Any:
    return service.class_report_cards(class_id, academic_year_id)


@router.get("/settings")
def get_settings(service: GradebookService = Depends(_service)) -> Any:
    return service.settings()


@router.put("/settings")
def put_settings(body: SettingsIn, service: GradebookService = Depends(_service)) -> Any:
    return service.update_settings(body.pass_mark)

# module: academics.remedial router
from typing import List, Optional
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.services.academics.remedial_service import RemedialService
from src.services.academics.promotion_service import PromotionService
from src.services.academics.promotion_status_service import PromotionStatusService

router = APIRouter(prefix="/remedial", tags=["remedial"])

class AssignRemedialRequest(BaseModel):
    academic_year_id: UUID
    student_id: UUID
    subject_ids: List[UUID]
    scheduled_date: Optional[date] = None

class IdentifyRiskRequest(BaseModel):
    academic_year_id: UUID
    grade_id: Optional[UUID] = None

@router.post("/identify")
async def identify_at_risk(
    payload: IdentifyRiskRequest,
    service: RemedialService = Depends()
):
    return await service.identify_students_at_risk(
        academic_year_id=payload.academic_year_id,
        grade_id=payload.grade_id
    )

@router.post("/assign")
async def assign_remedial(
    payload: AssignRemedialRequest,
    service: RemedialService = Depends(),
):
    count = 0
    for sid in payload.subject_ids:
        await service.assign(
            student_id=payload.student_id,
            subject_id=sid,
            academic_year_id=payload.academic_year_id,
            scheduled_date=payload.scheduled_date or date.today()
        )
        count += 1
    return {"created": count}

class CreateSessionsRequest(BaseModel):
    enrollment_id: UUID
    subject_ids: List[UUID]
    scheduled_date: Optional[date] = None

@router.post("/sessions")
async def create_sessions(
    payload: CreateSessionsRequest,
    db: Session = Depends(get_db),
    service: RemedialService = Depends(),
):
    from src.db.models.academics.enrollment import Enrollment
    enrollment = db.query(Enrollment).filter(Enrollment.id == payload.enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    created = 0
    for sid in payload.subject_ids:
        await service.assign(
            student_id=enrollment.student_id,
            subject_id=sid,
            academic_year_id=enrollment.academic_year_id,
            scheduled_date=payload.scheduled_date or date.today()
        )
        created += 1
    return {"created": created}

class RecordRemedialUpdateRequest(BaseModel):
    status: Optional[str] = None  # "scheduled" | "completed"
    new_score: Optional[float] = None
    passed: Optional[bool] = None

@router.put("/sessions/{id}")
async def update_session(
    id: UUID,
    payload: RecordRemedialUpdateRequest,
    db: Session = Depends(get_db),
    remedial_service: RemedialService = Depends(),
    promotion_service: PromotionService = Depends(),
):
    # Update the remedial session
    updated = await remedial_service.update(id=id, obj_in=payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Remedial session not found")

    # Re-evaluate promotion eligibility for the enrollment
    eval_result = await promotion_service.evaluate_eligibility(enrollment_id=updated.enrollment_id)
    # Upsert status done inside evaluate_eligibility via PromotionStatusService

    return {"session": updated, "evaluation": eval_result}
from fastapi import Query

from src.schemas.academics.promotion import RemedialSession

@router.get("/sessions", response_model=List[RemedialSession])
async def list_sessions(
    enrollment_id: Optional[UUID] = Query(None),
    skip: int = Query(0),
    limit: int = Query(100),
    service: RemedialService = Depends(),
):
    if enrollment_id:
        return await service.list_by_enrollment(enrollment_id)
    return await service.list_all(skip=skip, limit=limit)
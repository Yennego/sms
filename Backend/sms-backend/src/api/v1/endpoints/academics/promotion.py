from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from uuid import UUID

from src.schemas.academics.promotion import (
    PromotionCriteria, PromotionCriteriaCreate, PromotionCriteriaUpdate,
    PromotionEvaluationRequest, PromotionEvaluationResult,
    PromotionStatusCreate, PromotionStatusUpdate
)
from src.services.academics.promotion_criteria_service import PromotionCriteriaService
from src.services.academics.promotion_service import PromotionService
from src.services.academics.promotion_status_service import PromotionStatusService
from src.db.session import get_db
from sqlalchemy.orm import Session
from src.core.auth.dependencies import has_any_role
from src.schemas.auth import User

# Top-level router setup
router = APIRouter(prefix="/promotions", tags=["promotions"])

@router.get("/criteria", response_model=List[PromotionCriteria])
async def list_criteria(
    academic_year_id: Optional[UUID] = Query(None),
    grade_id: Optional[UUID] = Query(None),
    service: PromotionCriteriaService = Depends(),
):
    filters = {}
    # Service.list uses filters dict; accept optional filters
    if academic_year_id:
        filters["academic_year_id"] = academic_year_id
    if grade_id:
        filters["grade_id"] = grade_id
    return await service.list(skip=0, limit=100, filters=filters)

@router.post("/criteria", response_model=PromotionCriteria)
async def create_criteria(
    obj_in: PromotionCriteriaCreate,
    service: PromotionCriteriaService = Depends(),
    current_user: User = Depends(has_any_role(["admin"]))
):
    return await service.create(obj_in=obj_in)

@router.put("/criteria/{id}", response_model=PromotionCriteria)
async def update_criteria(
    id: UUID,
    obj_in: PromotionCriteriaUpdate,
    service: PromotionCriteriaService = Depends(),
    current_user: User = Depends(has_any_role(["admin"]))
):
    return await service.update(id=id, obj_in=obj_in)

@router.delete("/criteria/{id}")
async def delete_criteria(
    id: UUID,
    service: PromotionCriteriaService = Depends(),
    current_user: User = Depends(has_any_role(["admin"]))
):
    deleted = await service.delete(id=id)
    return {"deleted": bool(deleted)}

@router.post("/evaluate", response_model=List[PromotionEvaluationResult])
async def evaluate(
    payload: PromotionEvaluationRequest,
    db: Session = Depends(get_db),
    service: PromotionService = Depends(),
    current_user: User = Depends(has_any_role(["admin"]))
):
    results: List[PromotionEvaluationResult] = []
    enrollment_ids: List[UUID] = payload.enrollment_ids or []

    # If student_ids provided, resolve active enrollments
    if payload.student_ids:
        from src.db.crud.academics import enrollment as enrollment_crud
        for sid in payload.student_ids:
            en = enrollment_crud.get_active_enrollment(db, service.tenant_id, sid)
            if en:
                enrollment_ids.append(en.id)

    # Optional: gather enrollments by year+grade
    if payload.academic_year_id and payload.grade_id:
        from src.db.models.academics.enrollment import Enrollment
        q = (
            db.query(Enrollment.id)
            .filter(
                Enrollment.tenant_id == service.tenant_id,
                Enrollment.academic_year_id == payload.academic_year_id,
                Enrollment.grade_id == payload.grade_id,
                Enrollment.is_active == True
            )
        )
        if payload.section_id:
            q = q.filter(Enrollment.section_id == payload.section_id)
            
        enrollment_ids.extend([row.id for row in q.all()])

    for eid in enrollment_ids:
        res = await service.evaluate_eligibility(enrollment_id=eid)
        results.append(PromotionEvaluationResult(**res))
    return results

@router.get("/status/{enrollment_id}")
async def get_status(
    enrollment_id: UUID,
    service: PromotionStatusService = Depends()
):
    existing = await service.get_by_enrollment(enrollment_id)
    return existing or None

@router.get("/status")
async def get_status_by_student_year(
    student_id: UUID = Query(...),
    academic_year_id: UUID = Query(...),
    service: PromotionStatusService = Depends()
):
    return await service.get_by_student_year(student_id, academic_year_id)

@router.post("/status")
async def create_status(
    obj_in: PromotionStatusCreate,
    service: PromotionStatusService = Depends(),
    current_user: User = Depends(has_any_role(["admin"]))
):
    return await service.create(obj_in=obj_in)

@router.put("/status/{id}")
async def update_status(
    id: UUID,
    obj_in: PromotionStatusUpdate,
    service: PromotionStatusService = Depends(),
    current_user: User = Depends(has_any_role(["admin"]))
):
    return await service.update(id=id, obj_in=obj_in.model_dump(exclude_unset=True))

@router.post("/transition")
async def start_transition(
    current_year_id: UUID,
    target_year_name: str,
    service: PromotionService = Depends(),
    current_user: User = Depends(has_any_role(["admin"]))
):
    return await service.process_year_end_transition(current_year_id, target_year_name)

@router.post("/scaling")
async def apply_scaling(
    enrollment_id: UUID,
    scaling_points: float,
    notes: Optional[str] = None,
    service: PromotionService = Depends(),
    current_user: User = Depends(has_any_role(["admin"]))
):
    return await service.apply_manual_scaling(enrollment_id, scaling_points, notes)

#singular alias for routes under /promotion/*
alias_router = APIRouter(prefix="/promotion", tags=["promotions"])
alias_router.include_router(router)
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException, status
from src.services.academics.assessment_service import AssessmentService
from src.schemas.academics.assessment import Assessment, AssessmentCreate, AssessmentUpdate

router = APIRouter()

@router.get("/assessments", response_model=List[Assessment])
async def list_assessments(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    subject_id: Optional[UUID] = None,
    grade_id: Optional[UUID] = None,
    section_id: Optional[UUID] = None,
    academic_year_id: Optional[UUID] = None,
    is_published: Optional[bool] = None,
    service: AssessmentService = Depends()
):
    filters = {}
    if subject_id:
        filters["subject_id"] = subject_id
    if grade_id:
        filters["grade_id"] = grade_id
    if section_id:
        filters["section_id"] = section_id
    if academic_year_id:
        filters["academic_year_id"] = academic_year_id
    if is_published is not None:
        filters["is_published"] = is_published
        
    return await service.list(skip=skip, limit=limit, filters=filters)

@router.post("/assessments", response_model=Assessment, status_code=status.HTTP_201_CREATED)
async def create_assessment(
    payload: AssessmentCreate,
    service: AssessmentService = Depends()
):
    return await service.create(obj_in=payload)

@router.get("/assessments/{id}", response_model=Assessment)
async def get_assessment(
    id: UUID,
    service: AssessmentService = Depends()
):
    item = await service.get(id=id)
    if not item:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return item

@router.put("/assessments/{id}", response_model=Assessment)
async def update_assessment(
    id: UUID,
    payload: AssessmentUpdate,
    service: AssessmentService = Depends()
):
    return await service.update(id=id, obj_in=payload)

@router.delete("/assessments/{id}")
async def delete_assessment(
    id: UUID,
    service: AssessmentService = Depends()
):
    await service.delete(id=id)
    return {"message": "Assessment deleted successfully"}

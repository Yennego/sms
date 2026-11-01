"""Student roster with this year's class (paged) and bulk class placement."""
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.core.auth.dependencies import has_permission
from src.core.middleware.tenant import get_tenant_id_from_request
from src.db.session import get_db
from src.services.academics.class_placement_service import (
    MAX_PAGE_SIZE, MAX_PLACEMENT_BATCH, ClassPlacementService,
)

router = APIRouter(prefix="/class-placement", tags=["class-placement"])


def _service(db: Session = Depends(get_db), tenant_id=Depends(get_tenant_id_from_request)) -> ClassPlacementService:
    return ClassPlacementService(db=db, tenant_id=tenant_id)


class PlaceStudents(BaseModel):
    class_id: UUID
    student_ids: List[UUID] = Field(min_length=1, max_length=MAX_PLACEMENT_BATCH)


@router.get("/roster")
def get_roster(
    academic_year_id: Optional[UUID] = None,
    placement: str = Query("all", description="all, placed or unplaced"),
    class_id: Optional[UUID] = None,
    grade_id: Optional[UUID] = None,
    section_id: Optional[UUID] = None,
    student_status: Optional[str] = Query("active", description="Student status; empty for everyone"),
    q: Optional[str] = Query(None, max_length=100, description="Name, username or admission number"),
    sort: str = Query("name", description="name, admission_number or class"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=MAX_PAGE_SIZE),
    _=Depends(has_permission("view_students")),
    service: ClassPlacementService = Depends(_service),
) -> Any:
    """One page of students with their class this year (default: the current year)."""
    return service.roster(
        academic_year_id=academic_year_id, placement=placement, class_id=class_id, grade_id=grade_id,
        section_id=section_id, student_status=student_status or None, q=q, sort=sort, page=page, page_size=page_size,
    )


@router.post("")
def place_students(
    body: PlaceStudents, _=Depends(has_permission("manage_enrollment")), service: ClassPlacementService = Depends(_service),
) -> Any:
    """Place (or move) students into a class for its school year; all or nothing."""
    return service.place(body.class_id, body.student_ids)

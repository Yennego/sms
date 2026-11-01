"""Admissions: admit and enroll a student, find guardians, import a spreadsheet (phase3-api.md §2)."""
from datetime import date
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from src.core.auth.dependencies import has_permission
from src.core.middleware.tenant import get_tenant_id_from_request
from src.db.models.auth.username import username_problem
from src.db.session import get_db
from src.services.people.admission_service import AdmissionService

router = APIRouter()


def _service(db: Session = Depends(get_db), tenant_id=Depends(get_tenant_id_from_request)) -> AdmissionService:
    return AdmissionService(db=db, tenant_id=tenant_id)


def _username(v: Optional[str]) -> Optional[str]:
    v = (v or "").strip().lower() or None
    if v and username_problem(v):
        raise ValueError(f"Username {username_problem(v)}")
    return v


class StudentIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    admission_number: Optional[str] = Field(default=None, max_length=50)
    admission_date: Optional[date] = None
    address: Optional[str] = Field(default=None, max_length=255)

    _clean_username = field_validator("username")(lambda cls, v: _username(v))


class GuardianIn(BaseModel):
    existing_id: Optional[UUID] = None
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    relationship_type: Optional[str] = Field(default=None, max_length=50)
    phone_number: Optional[str] = Field(default=None, max_length=20)
    email: Optional[EmailStr] = None
    username: Optional[str] = None

    _clean_username = field_validator("username")(lambda cls, v: _username(v))

    @field_validator("last_name")
    @classmethod
    def names_for_new_guardian(cls, v, info):
        if not info.data.get("existing_id") and not (info.data.get("first_name") and v):
            raise ValueError("A new guardian needs a first and last name")
        return v


class AdmissionIn(BaseModel):
    student: StudentIn
    guardian: Optional[GuardianIn] = None
    class_id: UUID


class ImportIn(BaseModel):
    dry_run: bool = True
    rows: List[Dict[str, Any]]


@router.post("/admissions", status_code=status.HTTP_201_CREATED)
def admit_student(
    body: AdmissionIn, _=Depends(has_permission("manage_students")), service: AdmissionService = Depends(_service),
) -> Any:
    """Create the student, guardian and enrollment together, or nothing."""
    guardian = body.guardian.model_dump() if body.guardian else None
    if guardian and guardian.get("existing_id"):
        guardian = {"existing_id": guardian["existing_id"]}
    r = service.admit(body.student.model_dump(), guardian, body.class_id)
    return {
        "student": {"id": r.student.id, "name": f"{r.student.first_name} {r.student.last_name}",
                    "username": r.student.username, "admission_number": r.student.admission_number},
        "guardian": ({"id": r.guardian.id, "name": f"{r.guardian.first_name} {r.guardian.last_name}",
                      "username": r.guardian.username, "created": r.guardian_created} if r.guardian else None),
        "enrollment": {"id": r.enrollment.id, "class_id": r.klass.id, "class_name": r.klass.name,
                       "academic_year_id": r.enrollment.academic_year_id},
        "credentials": [c.__dict__ for c in r.credentials],
    }


@router.get("/guardians/search")
def search_guardians(
    q: str = Query(min_length=1, max_length=100),
    _=Depends(has_permission("view_students")), service: AdmissionService = Depends(_service),
) -> Any:
    """Guardians of this school matching a name, username, email or phone."""
    return service.search_guardians(q)


@router.post("/admissions/import")
def import_admissions(
    body: ImportIn, _=Depends(has_permission("manage_students")), service: AdmissionService = Depends(_service),
) -> Any:
    """Check (dry_run) or import spreadsheet rows; saved only if every row is valid."""
    return service.run_import(body.rows, body.dry_run)

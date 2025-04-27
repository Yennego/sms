from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List

from src.schemas.enrollment import Enrollment, EnrollmentCreate, EnrollmentUpdate
from src.db.session import get_db
from src.db.crud.enrollment import EnrollmentCRUD
from src.core.middleware.tenant import get_tenant_id_from_request

router = APIRouter()
crud = EnrollmentCRUD

@router.get("/", response_model=List[Enrollment])
def list_enrollments(db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    return crud.list(db, tenant_id=tenant_id)

@router.get("/{enrollment_id}", response_model=Enrollment)
def get_enrollment(enrollment_id: str, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    enrollment = crud.get_by_id(db, enrollment_id, tenant_id=tenant_id)
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return enrollment

@router.post("/", response_model=Enrollment)
def create_enrollment(enrollment_in: EnrollmentCreate, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    return crud.create(db, obj_in=enrollment_in, tenant_id=tenant_id)

@router.put("/{enrollment_id}", response_model=Enrollment)
def update_enrollment(enrollment_id: str, enrollment_in: EnrollmentUpdate, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    return crud.update(db, enrollment_id, obj_in=enrollment_in, tenant_id=tenant_id)

@router.delete("/{enrollment_id}")
def delete_enrollment(enrollment_id: str, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    crud.delete(db, enrollment_id, tenant_id=tenant_id)
    return {"ok": True}

@router.post("/bulk", response_model=List[Enrollment])
def bulk_create_enrollments(
    enrollments_in: List[EnrollmentCreate] = Body(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    return crud.bulk_create(db, enrollments_in, tenant_id=tenant_id)

@router.delete("/bulk")
def bulk_delete_enrollments(
    ids: List[str] = Body(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    count = crud.bulk_delete(db, ids, tenant_id=tenant_id)
    return {"deleted": count} 
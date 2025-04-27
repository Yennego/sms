from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List

from src.schemas.subject import Subject, SubjectCreate, SubjectUpdate
from src.db.session import get_db
from src.db.crud.subject import SubjectCRUD
from src.core.middleware.tenant import get_tenant_id_from_request

router = APIRouter()
crud = SubjectCRUD

@router.get("/", response_model=List[Subject])
def list_subjects(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    return crud.list(db, tenant_id=tenant_id)

@router.get("/{subject_id}", response_model=Subject)
def get_subject(
    subject_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    subject = crud.get_by_id(db, subject_id, tenant_id=tenant_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject

@router.post("/", response_model=Subject)
def create_subject(
    subject_in: SubjectCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    return crud.create(db, obj_in=subject_in, tenant_id=tenant_id)

@router.put("/{subject_id}", response_model=Subject)
def update_subject(
    subject_id: str,
    subject_in: SubjectUpdate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    return crud.update(db, subject_id, obj_in=subject_in, tenant_id=tenant_id)

@router.delete("/{subject_id}")
def delete_subject(
    subject_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    crud.delete(db, subject_id, tenant_id=tenant_id)
    return {"ok": True}

@router.post("/bulk", response_model=List[Subject])
def bulk_create_subjects(
    subjects_in: List[SubjectCreate] = Body(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    return crud.bulk_create(db, subjects_in, tenant_id=tenant_id)

@router.delete("/bulk")
def bulk_delete_subjects(
    ids: List[str] = Body(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    count = crud.bulk_delete(db, ids, tenant_id=tenant_id)
    return {"deleted": count} 
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List

from src.schemas.teacher import Teacher, TeacherCreate, TeacherUpdate
from src.db.session import get_db
from src.db.crud.teacher import TeacherCRUD
from src.core.middleware.tenant import get_tenant_id_from_request

router = APIRouter()
crud = TeacherCRUD

@router.get("/", response_model=List[Teacher])
def list_teachers(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    return crud.list(db, tenant_id=tenant_id)

@router.get("/{teacher_id}", response_model=Teacher)
def get_teacher(
    teacher_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    teacher = crud.get_by_id(db, teacher_id, tenant_id=tenant_id)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return teacher

@router.post("/", response_model=Teacher)
def create_teacher(
    teacher_in: TeacherCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    return crud.create(db, obj_in=teacher_in, tenant_id=tenant_id)

@router.put("/{teacher_id}", response_model=Teacher)
def update_teacher(
    teacher_id: str,
    teacher_in: TeacherUpdate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    return crud.update(db, teacher_id, obj_in=teacher_in, tenant_id=tenant_id)

@router.delete("/{teacher_id}")
def delete_teacher(
    teacher_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    crud.delete(db, teacher_id, tenant_id=tenant_id)
    return {"ok": True}

@router.post("/bulk", response_model=List[Teacher])
def bulk_create_teachers(
    teachers_in: List[TeacherCreate] = Body(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    return crud.bulk_create(db, teachers_in, tenant_id=tenant_id)

@router.delete("/bulk")
def bulk_delete_teachers(
    ids: List[str] = Body(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    count = crud.bulk_delete(db, ids, tenant_id=tenant_id)
    return {"deleted": count} 
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List

from src.schemas.student import Student, StudentCreate, StudentUpdate
from src.db.session import get_db
from src.db.crud.student import StudentCRUD
from src.core.middleware.tenant import get_tenant_id_from_request

router = APIRouter()
crud = StudentCRUD

@router.get("/", response_model=List[Student])
def list_students(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    return crud.list(db, tenant_id=tenant_id)

@router.get("/{student_id}", response_model=Student)
def get_student(
    student_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    student = crud.get_by_id(db, student_id, tenant_id=tenant_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student

@router.post("/", response_model=Student)
def create_student(
    student_in: StudentCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    return crud.create(db, obj_in=student_in, tenant_id=tenant_id)

@router.put("/{student_id}", response_model=Student)
def update_student(
    student_id: str,
    student_in: StudentUpdate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    return crud.update(db, student_id, obj_in=student_in, tenant_id=tenant_id)

@router.delete("/{student_id}")
def delete_student(
    student_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    crud.delete(db, student_id, tenant_id=tenant_id)
    return {"ok": True}

@router.post("/bulk", response_model=List[Student])
def bulk_create_students(
    students_in: List[StudentCreate] = Body(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    return crud.bulk_create(db, students_in, tenant_id=tenant_id)

@router.delete("/bulk")
def bulk_delete_students(
    ids: List[str] = Body(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    count = crud.bulk_delete(db, ids, tenant_id=tenant_id)
    return {"deleted": count} 
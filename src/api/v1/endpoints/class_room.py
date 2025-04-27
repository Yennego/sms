from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List

from src.schemas.class_room import ClassRoom, ClassCreate, ClassUpdate, ClassList, ClassWithTeacher
from src.db.session import get_db
from src.db.crud.class_room import ClassRoomCRUD
from src.core.middleware.tenant import get_tenant_id_from_request

router = APIRouter()
crud = ClassRoomCRUD

@router.get("/", response_model=ClassList)
def list_class_rooms(db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    classes = crud.list(db, tenant_id=tenant_id)
    return ClassList(classes=classes, total=len(classes))

@router.get("/{class_room_id}", response_model=ClassWithTeacher)
def get_class_room(class_room_id: str, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    class_room = crud.get_by_id(db, class_room_id, tenant_id=tenant_id)
    if not class_room:
        raise HTTPException(status_code=404, detail="Class room not found")
    return class_room

@router.post("/", response_model=ClassRoom)
def create_class_room(class_room_in: ClassCreate, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    return crud.create(db, obj_in=class_room_in, tenant_id=tenant_id)

@router.put("/{class_room_id}", response_model=ClassRoom)
def update_class_room(class_room_id: str, class_room_in: ClassUpdate, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    return crud.update(db, class_room_id, obj_in=class_room_in, tenant_id=tenant_id)

@router.delete("/{class_room_id}")
def delete_class_room(class_room_id: str, db: Session = Depends(get_db), tenant_id: str = Depends(get_tenant_id_from_request)):
    crud.delete(db, class_room_id, tenant_id=tenant_id)
    return {"ok": True}

@router.post("/bulk", response_model=List[ClassRoom])
def bulk_create_class_rooms(
    class_rooms_in: List[ClassCreate] = Body(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    return crud.bulk_create(db, class_rooms_in, tenant_id=tenant_id)

@router.delete("/bulk")
def bulk_delete_class_rooms(
    ids: List[str] = Body(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id_from_request)
):
    count = crud.bulk_delete(db, ids, tenant_id=tenant_id)
    return {"deleted": count} 
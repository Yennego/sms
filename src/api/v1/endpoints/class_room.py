from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from src.schemas.class_room import (
    ClassRoom,
    ClassRoomCreate,
    ClassRoomUpdate,
    ClassRoomList,
    ClassRoomWithTeacher
)
from src.db.session import get_db
from src.services.class_room import ClassRoomService
from src.core.middleware.tenant import get_tenant_id_from_request
from src.core.exceptions import ResourceNotFoundError

router = APIRouter()


@router.get("/", response_model=ClassRoomList)
def list_class_rooms(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
):
    """List all class rooms."""
    service = ClassRoomService(db, tenant_id)
    class_rooms = service.list(skip=skip, limit=limit)
    total = service.count()
    return ClassRoomList(items=class_rooms, total=total, skip=skip, limit=limit)


@router.post("/", response_model=ClassRoom)
def create_class_room(
    class_room_in: ClassRoomCreate,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
):
    """Create a new class room."""
    service = ClassRoomService(db, tenant_id)
    return service.create(class_room_in)


@router.post("/bulk", response_model=List[ClassRoom])
def bulk_create_class_rooms(
    class_rooms_in: List[ClassRoomCreate] = Body(...),
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
):
    """Bulk create class rooms."""
    service = ClassRoomService(db, tenant_id)
    return service.bulk_create(class_rooms_in)


@router.delete("/bulk")
def bulk_delete_class_rooms(
    ids: List[UUID] = Body(...),
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
):
    """Bulk delete class rooms."""
    service = ClassRoomService(db, tenant_id)
    service.bulk_delete(ids)
    return {"ok": True}


@router.get("/{class_room_id}", response_model=ClassRoomWithTeacher)
def get_class_room(
    class_room_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
):
    """Get a class room by ID."""
    service = ClassRoomService(db, tenant_id)
    try:
        return service.get_with_teacher(class_room_id)
    except ResourceNotFoundError:
        raise HTTPException(status_code=404, detail="Class room not found")


@router.put("/{class_room_id}", response_model=ClassRoom)
def update_class_room(
    class_room_id: UUID,
    class_room_in: ClassRoomUpdate,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
):
    """Update a class room."""
    service = ClassRoomService(db, tenant_id)
    try:
        return service.update(class_room_id, class_room_in)
    except ResourceNotFoundError:
        raise HTTPException(status_code=404, detail="Class room not found")


@router.delete("/{class_room_id}")
def delete_class_room(
    class_room_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id_from_request)
):
    """Delete a class room."""
    service = ClassRoomService(db, tenant_id)
    try:
        service.delete(class_room_id)
        return {"ok": True}
    except ResourceNotFoundError:
        raise HTTPException(status_code=404, detail="Class room not found") 
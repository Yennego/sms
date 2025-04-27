from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.services.base import TenantBaseService
from src.db.models.class_room import ClassRoom
from src.db.crud.class_room import class_room
from src.schemas.class_room import ClassRoomCreate, ClassRoomUpdate, ClassRoomWithTeacher
from src.core.exceptions import ResourceNotFoundError


class ClassRoomService(TenantBaseService[ClassRoom, ClassRoomCreate, ClassRoomUpdate]):
    """Service for ClassRoom operations."""
    
    def __init__(self, db: Session, tenant_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
        super().__init__(crud_base=class_room)
    
    def get_by_name_and_grade(self, name: str, grade_level: str) -> Optional[ClassRoom]:
        """Get a class room by name and grade level."""
        return self.crud.get_by_name_and_grade(self.db, self.tenant_id, name, grade_level)
    
    def get_by_teacher(self, teacher_id: UUID) -> List[ClassRoom]:
        """Get all class rooms taught by a specific teacher."""
        return self.crud.get_by_teacher(self.db, self.tenant_id, teacher_id)
    
    def get_active_class_rooms(self) -> List[ClassRoom]:
        """Get all active class rooms."""
        return self.crud.get_active_class_rooms(self.db, self.tenant_id)
    
    def create(self, obj_in: ClassRoomCreate) -> ClassRoom:
        """Create a new class room."""
        # Check if class room with same name and grade level exists
        if self.get_by_name_and_grade(obj_in.name, obj_in.grade_level):
            raise HTTPException(
                status_code=400,
                detail="A class room with this name and grade level already exists"
            )
        return self.crud.create(db=self.db, tenant_id=self.tenant_id, obj_in=obj_in)
    
    def bulk_create(self, objs_in: List[ClassRoomCreate]) -> List[ClassRoom]:
        """Bulk create class rooms."""
        # Check for duplicates
        for obj_in in objs_in:
            if self.get_by_name_and_grade(obj_in.name, obj_in.grade_level):
                raise HTTPException(
                    status_code=400,
                    detail=f"A class room with name '{obj_in.name}' and grade level '{obj_in.grade_level}' already exists"
                )
        return self.crud.bulk_create(self.db, objs_in=[obj_in.model_dump() for obj_in in objs_in], tenant_id=self.tenant_id)
    
    def bulk_delete(self, ids: List[UUID]) -> None:
        """Bulk delete class rooms."""
        self.crud.bulk_delete(self.db, ids=ids, tenant_id=self.tenant_id)
    
    def get_with_teacher(self, class_room_id: UUID) -> ClassRoomWithTeacher:
        """Get a class room with its teacher information."""
        class_room = self.get(id=class_room_id, db=self.db, tenant_id=self.tenant_id)
        if not class_room:
            raise ResourceNotFoundError("Class room not found")
        return ClassRoomWithTeacher.model_validate(class_room)
    
    def list(self, skip: int = 0, limit: int = 100):
        """List class rooms for the tenant."""
        return self.crud.get_multi(db=self.db, tenant_id=self.tenant_id, skip=skip, limit=limit)
    
    def count(self) -> int:
        """Return the count of class rooms for the tenant."""
        return self.crud.count(self.db, tenant_id=self.tenant_id)
    
    def update(self, id: UUID, obj_in: ClassRoomUpdate) -> ClassRoom:
        """Update a class room."""
        return super().update(id=id, obj_in=obj_in, db=self.db, tenant_id=self.tenant_id)
    
    def delete(self, id: UUID) -> None:
        """Delete a class room."""
        super().remove(id=id, db=self.db, tenant_id=self.tenant_id) 
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict

from src.schemas.base import BaseSchema
from src.schemas.teacher import Teacher

class ClassRoomBase(BaseSchema):
    """Base schema for ClassRoom model."""
    model_config = ConfigDict(from_attributes=True)
    
    name: str
    grade_level: str
    subject: str
    room_number: Optional[str] = None
    max_capacity: Optional[int] = None
    is_active: bool = True

class ClassRoomCreate(ClassRoomBase):
    """Schema for creating a new class room."""
    pass

class ClassRoomUpdate(BaseSchema):
    """Schema for updating a class room."""
    model_config = ConfigDict(from_attributes=True)
    
    name: Optional[str] = None
    grade_level: Optional[str] = None
    subject: Optional[str] = None
    room_number: Optional[str] = None
    max_capacity: Optional[int] = None
    is_active: Optional[bool] = None

class ClassRoomInDBBase(ClassRoomBase):
    """Base schema for ClassRoom in DB."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID

class ClassRoom(ClassRoomInDBBase):
    """Schema for ClassRoom response."""
    pass

class ClassRoomWithStudents(ClassRoom):
    """Schema for ClassRoom with students."""
    students: List[str] = []

class ClassRoomWithTeacher(ClassRoom):
    """Schema for ClassRoom with teacher."""
    teacher: Optional[Teacher] = None

class ClassRoomList(BaseSchema):
    """Schema for list of class rooms."""
    model_config = ConfigDict(from_attributes=True)
    
    items: List[ClassRoom]
    total: int
    skip: int = 0
    limit: int = 100
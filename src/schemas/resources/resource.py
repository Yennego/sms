from datetime import datetime
from typing import Optional, Literal
from uuid import UUID
from pydantic import BaseModel

from src.schemas.base.base import TimestampSchema, TenantSchema


class ResourceBase(BaseModel):
    """Base schema for Resource model."""
    title: str
    description: Optional[str] = None
    resource_type: Literal["document", "video", "audio", "image", "link", "other"]
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    file_extension: Optional[str] = None
    external_url: Optional[str] = None
    uploader_id: UUID
    subject_id: Optional[UUID] = None
    grade_id: Optional[UUID] = None
    is_public: str = "private"
    upload_date: datetime
    last_accessed: Optional[datetime] = None
    access_count: int = 0


class ResourceCreate(ResourceBase):
    """Schema for creating a new resource."""
    upload_date: datetime = datetime.now()


class ResourceUpdate(BaseModel):
    """Schema for updating a resource."""
    title: Optional[str] = None
    description: Optional[str] = None
    resource_type: Optional[Literal["document", "video", "audio", "image", "link", "other"]] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    file_extension: Optional[str] = None
    external_url: Optional[str] = None
    subject_id: Optional[UUID] = None
    grade_id: Optional[UUID] = None
    is_public: Optional[str] = None
    last_accessed: Optional[datetime] = None
    access_count: Optional[int] = None


class ResourceInDB(ResourceBase, TenantSchema):
    """Schema for Resource model in database."""
    class Config:
        from_attributes = True


class Resource(ResourceInDB):
    """Schema for Resource model response."""
    pass


class ResourceWithDetails(Resource):
    """Schema for Resource with additional details."""
    uploader_name: str
    subject_name: Optional[str] = None
    grade_name: Optional[str] = None
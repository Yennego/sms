from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
from src.schemas.base.base import PaginatedResponse


class SuperAdminActivityLogBase(BaseModel):
    user_id: Optional[UUID] = None
    action: str
    entity_type: str
    entity_id: Optional[UUID] = None
    target_tenant_id: Optional[UUID] = None
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    details: Optional[str] = None


class SuperAdminActivityLogCreate(SuperAdminActivityLogBase):
    pass


class SuperAdminActivityLogUpdate(SuperAdminActivityLogBase):
    action: Optional[str] = None
    entity_type: Optional[str] = None


class SuperAdminActivityLogInDBBase(SuperAdminActivityLogBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SuperAdminActivityLog(SuperAdminActivityLogInDBBase):
    pass


class SuperAdminActivityLogInDB(SuperAdminActivityLogInDBBase):
    pass


# Response model that matches frontend expectations
class AuditLogResponse(BaseModel):
    id: str
    timestamp: str
    user: str
    action: str
    details: str
    ipAddress: str
    
    class Config:
        from_attributes = True


class AuditLogPaginated(PaginatedResponse[AuditLogResponse]):
    """Schema for paginated audit log response (super-admin)."""
    pass
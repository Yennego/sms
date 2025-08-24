from pydantic import BaseModel, validator
from typing import Optional
from datetime import datetime
from uuid import UUID

class NotificationConfigRequest(BaseModel):
    whatsapp_enabled: bool
    admin_whatsapp_number: Optional[str] = None
    school_name: str
    teacher_welcome_template: Optional[str] = None
    student_welcome_template: Optional[str] = None
    parent_welcome_template: Optional[str] = None
    notify_admin_on_user_creation: bool = True
    notify_parents_on_student_creation: bool = True

class NotificationConfigResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    whatsapp_enabled: bool
    admin_whatsapp_number: Optional[str]
    school_name: str
    teacher_welcome_template: Optional[str]
    student_welcome_template: Optional[str]
    parent_welcome_template: Optional[str]
    notify_admin_on_user_creation: bool
    notify_parents_on_student_creation: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            UUID: str,
            datetime: lambda v: v.isoformat()
        }
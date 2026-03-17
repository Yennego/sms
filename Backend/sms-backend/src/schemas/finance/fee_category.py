from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class FeeCategoryBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None

class FeeCategoryCreate(FeeCategoryBase):
    pass

class FeeCategoryUpdate(FeeCategoryBase):
    name: Optional[str] = Field(None, max_length=100)

class FeeCategory(FeeCategoryBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

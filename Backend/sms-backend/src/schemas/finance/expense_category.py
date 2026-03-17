from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class ExpenseCategoryBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None

class ExpenseCategoryCreate(ExpenseCategoryBase):
    pass

class ExpenseCategoryUpdate(ExpenseCategoryBase):
    name: Optional[str] = Field(None, max_length=100)

class ExpenseCategory(ExpenseCategoryBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

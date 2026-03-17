from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal

class FeeStructureBase(BaseModel):
    category_id: UUID
    academic_year_id: UUID
    grade_id: Optional[UUID] = None
    amount: Decimal = Field(..., ge=0)
    due_date: date

class FeeStructureCreate(FeeStructureBase):
    pass

class FeeStructureUpdate(BaseModel):
    category_id: Optional[UUID] = None
    academic_year_id: Optional[UUID] = None
    grade_id: Optional[UUID] = None
    amount: Optional[Decimal] = Field(None, ge=0)
    due_date: Optional[date] = None

class FeeStructure(FeeStructureBase):
    id: UUID
    tenant_id: UUID
    category_name: Optional[str] = None
    grade_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

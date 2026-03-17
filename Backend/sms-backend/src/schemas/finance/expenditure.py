from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal

class ExpenditureBase(BaseModel):
    expense_category_id: UUID
    amount: Decimal = Field(..., ge=0)
    date: date
    payee: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None

class ExpenditureCreate(ExpenditureBase):
    pass

class ExpenditureUpdate(BaseModel):
    expense_category_id: Optional[UUID] = None
    amount: Optional[Decimal] = Field(None, ge=0)
    date: Optional[date] = None
    payee: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None

class Expenditure(ExpenditureBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

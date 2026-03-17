from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal

class FeeInstallmentBase(BaseModel):
    student_fee_id: UUID
    amount: Decimal = Field(..., ge=0)
    due_date: date
    status: str = Field(default="PENDING", max_length=20)

class FeeInstallmentCreate(FeeInstallmentBase):
    pass

class FeeInstallmentCreateNested(BaseModel):
    amount: Decimal = Field(..., ge=0)
    due_date: date
    status: str = Field(default="PENDING", max_length=20)

class FeeInstallmentUpdate(BaseModel):
    amount: Optional[Decimal] = Field(None, ge=0)
    due_date: Optional[date] = None
    status: Optional[str] = Field(None, max_length=20)

class FeeInstallment(FeeInstallmentBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    student_name: Optional[str] = None
    category_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

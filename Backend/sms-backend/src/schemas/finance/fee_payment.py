from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal

class FeePaymentBase(BaseModel):
    student_fee_id: UUID
    amount_paid: Decimal = Field(..., ge=0)
    payment_method: str = Field(..., max_length=50)
    reference_id: Optional[str] = Field(None, max_length=100)

class FeePaymentCreate(FeePaymentBase):
    pass

class FeePaymentUpdate(BaseModel):
    amount_paid: Optional[Decimal] = Field(None, ge=0)
    payment_method: Optional[str] = Field(None, max_length=50)
    reference_id: Optional[str] = Field(None, max_length=100)

class FeePayment(FeePaymentBase):
    id: UUID
    tenant_id: UUID
    payment_date: datetime
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

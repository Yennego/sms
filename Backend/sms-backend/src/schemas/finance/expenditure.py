from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Literal, Optional
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal

# Each expense is in one currency; USD and LRD totals are kept apart (phase5-design.md)
Currency = Literal["USD", "LRD"]

class ExpenditureBase(BaseModel):
    expense_category_id: UUID
    amount: Decimal = Field(..., ge=0, max_digits=12, decimal_places=2)
    currency: Currency
    date: date
    payee: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None

class ExpenditureCreate(ExpenditureBase):
    pass

class ExpenditureUpdate(BaseModel):
    expense_category_id: Optional[UUID] = None
    amount: Optional[Decimal] = Field(None, ge=0, max_digits=12, decimal_places=2)
    currency: Optional[Currency] = None
    date: Optional[date] = None
    payee: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None

    @field_validator("expense_category_id", "amount", "currency", "date")
    @classmethod
    def not_null(cls, value):
        # Leave these out to keep them; they can't be cleared
        if value is None:
            raise ValueError("can't be empty")
        return value

class Expenditure(ExpenditureBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

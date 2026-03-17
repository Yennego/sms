from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from src.schemas.finance.fee_installment import FeeInstallment, FeeInstallmentCreateNested

class StudentFeeBase(BaseModel):
    fee_structure_id: UUID
    student_id: UUID
    total_amount: Decimal = Field(..., ge=0)
    amount_paid: Decimal = Field(default=0.0, ge=0)
    balance: Decimal = Field(..., ge=0)
    status: str = Field(default="PENDING", max_length=20)

class StudentFeeCreate(StudentFeeBase):
    installments: Optional[List[FeeInstallmentCreateNested]] = None

class BulkStudentFeeCreate(BaseModel):
    fee_structure_id: UUID
    installments: Optional[List[FeeInstallmentCreateNested]] = None

class StudentFeeUpdate(BaseModel):
    amount_paid: Optional[Decimal] = Field(None, ge=0)
    balance: Optional[Decimal] = Field(None, ge=0)
    status: Optional[str] = Field(None, max_length=20)

class StudentFee(StudentFeeBase):
    id: UUID
    tenant_id: UUID
    student_name: Optional[str] = None
    category_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class StudentFeeWithDetails(StudentFee):
    student_name: str
    category_name: str
    due_date: datetime
    installments: Optional[List[FeeInstallment]] = None

from datetime import date
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from src.schemas.base.base import TimestampSchema, TenantSchema

class PeriodBase(BaseModel):
    name: str = Field(..., description="Period name, e.g., 'P1'")
    period_number: int = Field(..., description="Period number (1 to 6)")
    start_date: date = Field(..., description="Period start date")
    end_date: date = Field(..., description="Period end date")
    is_published: bool = Field(default=False, description="Global publication flag")
    is_active: bool = Field(default=True, description="Whether this period is active")

class PeriodCreate(PeriodBase):
    semester_id: UUID

class PeriodUpdate(BaseModel):
    name: Optional[str] = None
    period_number: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_published: Optional[bool] = None
    is_active: Optional[bool] = None

class PeriodInDB(PeriodBase, TenantSchema):
    id: UUID
    semester_id: UUID
    model_config = ConfigDict(from_attributes=True)

class Period(PeriodInDB):
    pass

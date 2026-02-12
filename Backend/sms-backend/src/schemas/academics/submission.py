from typing import Optional, List, Dict, Any
from pydantic import BaseModel, UUID4
from datetime import datetime
from enum import Enum

class SubmissionStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    GRADED = "GRADED"
    RETURNED = "RETURNED"

class SubmissionBase(BaseModel):
    assignment_id: UUID4
    content: Optional[str] = None
    attachment_url: Optional[str] = None
    status: SubmissionStatus = SubmissionStatus.SUBMITTED
    score: Optional[float] = None
    feedback: Optional[str] = None

class SubmissionCreate(SubmissionBase):
    pass

class SubmissionUpdate(BaseModel):
    content: Optional[str] = None
    attachment_url: Optional[str] = None
    status: Optional[SubmissionStatus] = None
    score: Optional[float] = None
    feedback: Optional[str] = None

class SubmissionGrade(BaseModel):
    score: float
    feedback: Optional[str] = None

class SubmissionResponse(SubmissionBase):
    id: UUID4
    student_id: UUID4
    submitted_at: datetime
    tenant_id: UUID4

    class Config:
        from_attributes = True

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from src.db.models.academics.attendance import AttendanceStatus

ScanMode = Literal["check_in", "check_out"]

# Why a scan was rejected; the scanner screen maps these to messages
ScanRejectReason = Literal[
    "invalid_signature",   # not one of our cards, or tampered
    "wrong_tenant",        # card from another school / scanner logged into the wrong school
    "unknown_student",
    "revoked",             # card was reissued; this is an old card
    "inactive_student",    # graduated, withdrawn, transferred
    "not_school_day",
    "scan_closed",         # after scan_closes_at
    "not_enrolled",        # no active class enrollment today
    "not_your_class",      # sponsor scanning another class's student
    "checkout_disabled",
    "not_checked_in",      # check-out without a check-in
]


class ScanRequest(BaseModel):
    token: str = Field(..., min_length=1, max_length=512)
    mode: ScanMode = "check_in"
    device_label: Optional[str] = Field(None, max_length=100)


class ManualCheckInRequest(BaseModel):
    admission_number: str = Field(..., min_length=1, max_length=50)
    device_label: Optional[str] = Field(None, max_length=100)


class ScannedStudent(BaseModel):
    id: UUID
    name: str
    admission_number: Optional[str] = None
    photo: Optional[str] = None
    class_name: Optional[str] = None


class ScanResult(BaseModel):
    result: Literal["accepted", "duplicate", "rejected"]
    reason: Optional[ScanRejectReason] = None
    mode: ScanMode = "check_in"
    student: Optional[ScannedStudent] = None
    status: Optional[AttendanceStatus] = None
    check_in_at: Optional[datetime] = None
    check_out_at: Optional[datetime] = None


class IdCard(BaseModel):
    student_id: UUID
    student_name: str
    admission_number: Optional[str] = None
    photo: Optional[str] = None
    class_name: Optional[str] = None
    academic_year: Optional[str] = None
    card_version: int
    card_issued_at: Optional[datetime] = None
    qr_svg: str

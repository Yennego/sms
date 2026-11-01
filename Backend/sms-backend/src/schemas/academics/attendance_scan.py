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
    "scan_expired",        # a saved (offline) scan read on an earlier day or over 12 hours ago
    "not_enrolled",        # no active class enrollment today
    "not_your_class",      # sponsor scanning another class's student
    "checkout_disabled",
    "not_checked_in",      # check-out without a check-in
]


class QueuedScanFields(BaseModel):
    """Sent by the gate scanner, also for scans it queued while offline (phase6-design.md §5).
    scanned_at: when the card was read (ISO 8601 with offset; no offset means UTC). It decides
    present/late only if it is today (school time), not in the future and at most 12 hours old;
    otherwise the server's time is used. client_scan_id: a unique id per scan (e.g. a UUID); the
    same id sent again returns the first result without counting the scan twice."""
    scanned_at: Optional[datetime] = None
    client_scan_id: Optional[str] = Field(None, min_length=1, max_length=64)


class ScanRequest(QueuedScanFields):
    token: str = Field(..., min_length=1, max_length=512)
    mode: ScanMode = "check_in"
    device_label: Optional[str] = Field(None, max_length=100)


class ManualCheckInRequest(QueuedScanFields):
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

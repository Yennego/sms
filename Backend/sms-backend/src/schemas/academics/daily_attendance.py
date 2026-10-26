from datetime import date, datetime, time
from datetime import date as DateType  # for fields named `date`
from typing import List, Optional
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.db.models.academics.attendance import AttendanceStatus
from src.db.models.academics.daily_attendance import AttendanceSource, ExcuseStatus

MANUAL_STATUSES = {
    AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.ABSENT,
    AttendanceStatus.EXCUSED, AttendanceStatus.SICK,
}


# --- Settings & calendar -------------------------------------------------------------

class AttendanceSettingsBase(BaseModel):
    timezone: str = "Africa/Monrovia"
    school_days: List[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4], description="date.weekday(): Mon=0 … Sun=6")
    late_after: time = time(8, 0)
    scan_closes_at: time = time(12, 0)
    auto_absent_at: time = time(12, 0)
    allow_checkout_scan: bool = False

    @field_validator("timezone")
    @classmethod
    def _valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError(f"Unknown timezone: {value}")
        return value

    @field_validator("school_days")
    @classmethod
    def _valid_days(cls, value: List[int]) -> List[int]:
        if any(d < 0 or d > 6 for d in value):
            raise ValueError("school_days must be weekday numbers 0 (Mon) to 6 (Sun)")
        return sorted(set(value))

    @model_validator(mode="after")
    def _ordered_times(self):
        if not (self.late_after <= self.scan_closes_at):
            raise ValueError("late_after must be at or before scan_closes_at")
        return self


class AttendanceSettingsUpdate(AttendanceSettingsBase):
    pass


class AttendanceSettingsRead(AttendanceSettingsBase):
    model_config = ConfigDict(from_attributes=True)


class SchoolCalendarDayUpsert(BaseModel):
    is_school_day: bool = False
    label: Optional[str] = Field(None, max_length=100)


class SchoolCalendarDayRead(BaseModel):
    date: DateType
    is_school_day: bool
    label: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SchoolDayInfo(BaseModel):
    date: DateType
    is_school_day: bool
    reason: Optional[str] = None          # why it is / isn't a school day
    today: DateType                        # school-local today
    auto_absent_applied: bool = False      # unmarked students are counted absent for this date


# --- Daily attendance ----------------------------------------------------------------

class DailyAttendanceRead(BaseModel):
    id: UUID
    student_id: UUID
    class_id: UUID
    academic_year_id: UUID
    date: DateType
    status: AttendanceStatus
    source: AttendanceSource
    check_in_at: Optional[datetime] = None
    check_out_at: Optional[datetime] = None
    marked_by: Optional[UUID] = None
    marked_at: datetime
    excuse_reason: Optional[str] = None
    excuse_status: Optional[ExcuseStatus] = None
    excuse_document_url: Optional[str] = None
    excuse_reviewed_by: Optional[UUID] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DailyRosterEntry(BaseModel):
    student_id: UUID
    student_name: str
    admission_number: Optional[str] = None
    photo: Optional[str] = None
    record: Optional[DailyAttendanceRead] = None  # None = not marked yet


class DailyRoster(BaseModel):
    class_id: UUID
    class_name: Optional[str] = None
    day: SchoolDayInfo
    entries: List[DailyRosterEntry]


class DailyStatusSet(BaseModel):
    """Manual mark by a sponsor/admin."""
    status: AttendanceStatus
    notes: Optional[str] = None
    excuse_reason: Optional[str] = Field(None, description="Required when status is 'excused'")
    excuse_document_url: Optional[str] = Field(None, max_length=500)

    @field_validator("status", mode="before")
    @classmethod
    def _lower(cls, value):
        return value.lower() if isinstance(value, str) else value

    @model_validator(mode="after")
    def _check(self):
        if self.status not in MANUAL_STATUSES:
            raise ValueError(f"Status '{self.status.value}' can't be set manually")
        if self.status == AttendanceStatus.EXCUSED and not (self.excuse_reason or "").strip():
            raise ValueError("excuse_reason is required when marking a student excused")
        return self


class DailyBulkEntry(DailyStatusSet):
    student_id: UUID


class DailyBulkSet(BaseModel):
    class_id: UUID
    date: Optional[DateType] = None  # defaults to school-local today
    entries: List[DailyBulkEntry] = Field(..., min_length=1)


class ExcuseSet(BaseModel):
    reason: str = Field(..., min_length=1)
    document_url: Optional[str] = Field(None, max_length=500)


class ExcuseReview(BaseModel):
    approve: bool
    notes: Optional[str] = None


class DailyAttendanceSummary(BaseModel):
    school_days: int
    present: int
    late: int
    absent: int
    excused: int
    sick: int
    attendance_rate: Optional[float] = None  # None when there are no countable (non-excused) days


class StudentDailyHistory(BaseModel):
    student_id: UUID
    student_name: Optional[str] = None
    admission_number: Optional[str] = None
    start_date: DateType
    end_date: DateType
    summary: DailyAttendanceSummary
    records: List[DailyAttendanceRead]


class AttendanceEventRead(BaseModel):
    id: UUID
    event_type: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    actor_id: Optional[UUID] = None
    actor_name: Optional[str] = None
    device_label: Optional[str] = None
    reason: Optional[str] = None
    occurred_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CloseDayResult(BaseModel):
    date: DateType
    marked_absent: int


# --- Excuse documents & parent submissions -------------------------------------------

EXCUSE_DOCUMENT_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
MAX_EXCUSE_DOCUMENT_BYTES = 5 * 1024 * 1024


class ExcuseDocumentIn(BaseModel):
    """Sent as base64 JSON: binary bodies don't pass reliably through the Next.js proxy."""
    filename: str = Field(..., min_length=1, max_length=255)
    content_type: str
    data_base64: str = Field(..., min_length=1, max_length=(MAX_EXCUSE_DOCUMENT_BYTES * 4) // 3 + 16)

    @field_validator("content_type")
    @classmethod
    def _allowed_type(cls, value: str) -> str:
        if value not in EXCUSE_DOCUMENT_TYPES:
            raise ValueError("Only JPEG, PNG, WebP images or PDF files are allowed")
        return value


class ExcuseDocumentOut(BaseModel):
    filename: str
    content_type: str
    size_bytes: int
    data_base64: str


class ExcuseWithDocument(ExcuseSet):
    document: Optional[ExcuseDocumentIn] = None


class ParentExcuseCreate(BaseModel):
    student_id: UUID
    date: DateType
    reason: str = Field(..., min_length=3, max_length=2000)
    document: Optional[ExcuseDocumentIn] = None


class ExcuseListItem(BaseModel):
    daily_id: UUID
    student_id: UUID
    student_name: str
    class_name: Optional[str] = None
    date: DateType
    status: AttendanceStatus
    excuse_status: Optional[ExcuseStatus] = None
    excuse_reason: Optional[str] = None
    has_document: bool
    submitted_by_name: Optional[str] = None
    submitted_at: datetime


class ChildSummary(BaseModel):
    student_id: UUID
    name: str
    admission_number: Optional[str] = None
    class_name: Optional[str] = None


# --- Reporting -------------------------------------------------------------------------

class AttendanceCounts(BaseModel):
    enrolled: int = 0
    present: int = 0      # includes tardy
    late: int = 0
    absent: int = 0
    excused: int = 0
    sick: int = 0
    unmarked: int = 0
    scanned: int = 0      # checked in by QR card
    attendance_rate: Optional[float] = None  # None when nothing countable yet


class ClassOverview(AttendanceCounts):
    class_id: UUID
    class_name: Optional[str] = None
    sponsor_name: Optional[str] = None


class DailyOverview(BaseModel):
    day: SchoolDayInfo
    totals: AttendanceCounts
    classes: List[ClassOverview]
    pending_excuses: int


class StudentReportRow(BaseModel):
    student_id: UUID
    student_name: str
    admission_number: Optional[str] = None
    present: int
    late: int
    absent: int
    excused: int
    sick: int
    unmarked: int
    attendance_rate: Optional[float] = None


class ClassAttendanceReport(BaseModel):
    class_id: UUID
    class_name: Optional[str] = None
    start_date: DateType
    end_date: DateType
    school_days: int
    rows: List[StudentReportRow]
    totals: AttendanceCounts

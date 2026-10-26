from datetime import time
import enum

from sqlalchemy import (
    Column, String, ForeignKey, Date, DateTime, Text, Enum, Boolean, Time, JSON, Integer, LargeBinary,
    UniqueConstraint, Index, func
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from src.db.models.base import TenantModel
from src.db.models.academics.attendance import AttendanceStatus


class AttendanceSource(str, enum.Enum):
    """How a daily attendance record was last set."""
    QR = "qr"            # ID card scan
    MANUAL = "manual"    # sponsor/admin marked it
    AUTO = "auto"        # system marked absent at cut-off


class ExcuseStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class AttendanceEventType(str, enum.Enum):
    SCAN_ACCEPTED = "scan_accepted"
    SCAN_DUPLICATE = "scan_duplicate"
    SCAN_REJECTED = "scan_rejected"
    MANUAL_SET = "manual_set"
    EXCUSE_SET = "excuse_set"
    EXCUSE_REVIEWED = "excuse_reviewed"
    AUTO_ABSENT = "auto_absent"


class DailyAttendance(TenantModel):
    """Whether a student was at school on a given school day.

    One row per student per school-local date; the source of truth for daily presence.
    Subject/period attendance stays in the `attendances` table.
    """

    __tablename__ = "daily_attendances"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)  # homeroom at time of marking
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)  # school-local date
    status = Column(Enum(AttendanceStatus), nullable=False)

    check_in_at = Column(DateTime(timezone=True), nullable=True)   # first successful scan
    check_out_at = Column(DateTime(timezone=True), nullable=True)
    source = Column(Enum(AttendanceSource), nullable=False)
    marked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # null for AUTO
    marked_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Excuse
    excuse_reason = Column(Text, nullable=True)
    excuse_status = Column(Enum(ExcuseStatus), nullable=True)
    excuse_document_url = Column(String(500), nullable=True)
    excuse_reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    notes = Column(Text, nullable=True)

    student = relationship("Student", foreign_keys=[student_id])
    class_obj = relationship("Class", foreign_keys=[class_id])

    __table_args__ = (
        UniqueConstraint("tenant_id", "student_id", "date", name="uq_daily_attendance_student_date"),
        Index("idx_daily_att_tenant_class_date", "tenant_id", "class_id", "date"),
    )

    def __repr__(self):
        return f"<DailyAttendance {self.student_id} {self.date} {self.status} ({self.source})>"


class AttendanceEvent(TenantModel):
    """Append-only log of every scan attempt and every change to daily attendance."""

    __tablename__ = "attendance_events"

    daily_attendance_id = Column(UUID(as_uuid=True), ForeignKey("daily_attendances.id"), nullable=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=True)  # null if token unreadable
    event_type = Column(String(30), nullable=False)  # AttendanceEventType value
    old_status = Column(String(20), nullable=True)
    new_status = Column(String(20), nullable=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    device_label = Column(String(100), nullable=True)  # e.g. "Main gate tablet"
    reason = Column(Text, nullable=True)               # rejection reason / manual note
    occurred_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Lets the unit of work insert the attendance row before its events
    daily_attendance = relationship("DailyAttendance", foreign_keys=[daily_attendance_id])

    __table_args__ = (
        Index("idx_att_events_tenant_daily", "tenant_id", "daily_attendance_id"),
    )


class AttendanceSettings(TenantModel):
    """Per-tenant attendance rules. Kept out of TenantSettings.settings (JSON) because
    the existing settings endpoints replace that column wholesale."""

    __tablename__ = "attendance_settings"

    timezone = Column(String(64), nullable=False, default="Africa/Monrovia")
    school_days = Column(JSON, nullable=False, default=lambda: [0, 1, 2, 3, 4])  # date.weekday(): Mon=0
    late_after = Column(Time, nullable=False, default=time(8, 0))
    scan_closes_at = Column(Time, nullable=False, default=time(12, 0))
    auto_absent_at = Column(Time, nullable=False, default=time(12, 0))
    allow_checkout_scan = Column(Boolean, nullable=False, default=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", name="uq_attendance_settings_tenant"),
    )


class SchoolCalendarDay(TenantModel):
    """Overrides the weekly school_days: holidays (is_school_day=False) or make-up days (True)."""

    __tablename__ = "school_calendar_days"

    date = Column(Date, nullable=False)
    is_school_day = Column(Boolean, nullable=False, default=False)
    label = Column(String(100), nullable=True)  # e.g. "Independence Day"

    __table_args__ = (
        UniqueConstraint("tenant_id", "date", name="uq_school_calendar_day"),
    )


class AttendanceDocument(TenantModel):
    """Supporting document for an excuse (doctor's note, parent letter).

    Stored in the database: the app has no persistent file storage (Render's disk is
    wiped on deploy). One document per daily record; uploading again replaces it.
    """

    __tablename__ = "attendance_documents"

    daily_attendance_id = Column(UUID(as_uuid=True), ForeignKey("daily_attendances.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    data = Column(LargeBinary, nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "daily_attendance_id", name="uq_attendance_document_record"),
    )

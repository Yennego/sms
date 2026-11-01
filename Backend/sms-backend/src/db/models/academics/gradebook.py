"""Marks, publications and the school's grading settings (docs/remodel/phase4-design.md §2)."""
from datetime import datetime, UTC

from sqlalchemy import (
    Column, String, ForeignKey, Integer, Numeric, Text, DateTime, UniqueConstraint, CheckConstraint, Index, text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID

from src.db.models.base import TenantModel
from src.db.models.tenant.school_profile import UserSignature  # noqa: F401  target of the signature keys

SCORE_STATUSES = ("scored", "absent", "excused")


class ScoreEntry(TenantModel):
    """One student's mark on one assessment. Excused: left out of averages; absent: counts as 0."""

    __tablename__ = "score_entries"

    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    enrollment_id = Column(UUID(as_uuid=True), ForeignKey("enrollments.id"), nullable=False)
    score = Column(Numeric(asdecimal=False), nullable=True)
    status = Column(String(10), nullable=False, default="scored")
    comment = Column(Text, nullable=True)
    entered_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    entered_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))

    assessment = relationship("Assessment", back_populates="scores")

    __table_args__ = (
        UniqueConstraint("assessment_id", "student_id", name="uq_score_entries_assessment_student"),
        CheckConstraint("status IN ('scored', 'absent', 'excused')", name="ck_score_entries_status"),
        CheckConstraint("(status = 'scored' AND score IS NOT NULL AND score >= 0) "
                        "OR (status <> 'scored' AND score IS NULL)", name="ck_score_entries_score"),
        Index("ix_score_entries_tenant_student", "tenant_id", "student_id"),
    )


class ResultPublication(TenantModel):
    """A class's results for one period, or for one semester (its exam and semester average),
    are visible to students and parents while this row exists."""

    __tablename__ = "result_publications"

    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    period_id = Column(UUID(as_uuid=True), ForeignKey("periods.id", ondelete="CASCADE"), nullable=True)
    semester_id = Column(UUID(as_uuid=True), ForeignKey("semesters.id", ondelete="CASCADE"), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    published_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    # Who signs the cards and with which signature, fixed at publication (§6)
    sponsor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    sponsor_signature_id = Column(UUID(as_uuid=True), ForeignKey("user_signatures.id", ondelete="SET NULL"), nullable=True)
    principal_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    principal_signature_id = Column(UUID(as_uuid=True), ForeignKey("user_signatures.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "class_id", "period_id", name="uq_result_publications_class_period"),
        UniqueConstraint("tenant_id", "class_id", "semester_id", name="uq_result_publications_class_semester"),
        CheckConstraint("(period_id IS NULL) <> (semester_id IS NULL)", name="ck_result_publications_one_column"),
    )


class ReportCardVerification(TenantModel):
    """What an issued report card showed (published results only), under a random code that its
    QR links to (§7). The same snapshot keeps its code; a changed one gets a new record and the
    previous record is marked superseded."""

    __tablename__ = "report_card_verifications"

    code = Column(String(12), nullable=False, unique=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False)
    snapshot = Column(JSONB, nullable=False)
    snapshot_hash = Column(String(64), nullable=False)
    issued_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    superseded_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_report_card_verifications_student_year", "tenant_id", "student_id", "academic_year_id"),
        # one current (not superseded) record per student and year
        Index("uq_report_card_verifications_current", "tenant_id", "student_id", "academic_year_id", unique=True,
              postgresql_where=text("superseded_at IS NULL"), sqlite_where=text("superseded_at IS NULL")),
    )


class GradingSettings(TenantModel):
    """One row per school; a grade level's promotion criteria can override the pass mark."""

    __tablename__ = "grading_settings"

    pass_mark = Column(Integer, nullable=False, default=70)

    __table_args__ = (
        UniqueConstraint("tenant_id", name="uq_grading_settings_tenant"),
        CheckConstraint("pass_mark BETWEEN 0 AND 100", name="ck_grading_settings_pass_mark"),
    )

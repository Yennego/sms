from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from src.db.models.base import TenantModel

AUDIENCES = ("all", "role", "class", "family")
AUDIENCE_ROLES = ("parents", "students", "teachers", "staff")


class Announcement(TenantModel):
    """A one-way message, sent once to an audience (phase6-design.md §1): everyone, a role, a
    class (its students and their parents) or one family (a student and their parents). Each
    recipient gets an inbox notification; withdrawing removes those notifications."""

    __tablename__ = "announcements"

    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    audience = Column(String(10), nullable=False)
    audience_role = Column(String(20), nullable=True)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=False)
    withdrawn_at = Column(DateTime(timezone=True), nullable=True)
    withdrawn_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    recipient_count = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        CheckConstraint("audience IN ('all', 'role', 'class', 'family')", name="ck_announcements_audience"),
        CheckConstraint("(audience = 'role') = (audience_role IS NOT NULL)", name="ck_announcements_role"),
        CheckConstraint("(audience = 'class') = (class_id IS NOT NULL)", name="ck_announcements_class"),
        CheckConstraint("(audience = 'family') = (student_id IS NOT NULL)", name="ck_announcements_family"),
        CheckConstraint("audience_role IS NULL OR audience_role IN ('parents', 'students', 'teachers', 'staff')",
                        name="ck_announcements_audience_role"),
        Index("ix_announcements_sent_at", "tenant_id", "sent_at"),
    )

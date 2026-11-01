"""Alerts (docs/remodel/phase6-design.md §3): the in-app inbox, the email/SMS delivery log and
each user's email switches.

A notification is one line in one user's inbox. It is unique per (school, user, event,
source_key), so repeating the action that caused it (re-running the cut-off, publishing again)
adds nothing. Email and SMS copies are deliveries, sent later by scripts/send_notifications.py.
"""
from sqlalchemy import (
    JSON, Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.db.models.base import TenantModel

EVENTS = ("attendance_absent", "attendance_late", "results_published", "payment_received", "announcement",
          "billing_reminder")
# Events a user can switch email off for; platform billing reminders to school admins always go
PREFERENCE_EVENTS = EVENTS[:5]
CHANNELS = ("email", "sms")
DELIVERY_STATUSES = ("queued", "sent", "failed", "skipped")


class Notification(TenantModel):
    __tablename__ = "notifications"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    event = Column(String(40), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    link = Column(String(500), nullable=True)  # an app path, e.g. /foundation/parent/attendance?child=...
    data = Column(JSON, nullable=True)
    source_key = Column(String(200), nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)

    deliveries = relationship("NotificationDelivery", back_populates="notification")

    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", "event", "source_key", name="uq_notifications_user_event_source"),
        Index("ix_notifications_inbox", "tenant_id", "user_id", "created_at"),
    )


class NotificationDelivery(TenantModel):
    """An email or SMS copy of a notification. The worker sends queued rows (three attempts,
    with backoff: next_attempt_at), then marks them sent, failed or skipped."""

    __tablename__ = "notification_deliveries"

    notification_id = Column(UUID(as_uuid=True), ForeignKey("notifications.id"), nullable=False)
    channel = Column(String(10), nullable=False)
    status = Column(String(10), nullable=False, default="queued")
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)
    provider_ref = Column(String(255), nullable=True)
    next_attempt_at = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)

    notification = relationship("Notification", back_populates="deliveries")

    __table_args__ = (
        CheckConstraint("channel IN ('email', 'sms')", name="ck_notification_deliveries_channel"),
        CheckConstraint("status IN ('queued', 'sent', 'failed', 'skipped')", name="ck_notification_deliveries_status"),
        Index("ix_notification_deliveries_queue", "status", "next_attempt_at"),
        Index("ix_notification_deliveries_notification", "tenant_id", "notification_id"),
    )


class NotificationPreference(TenantModel):
    """A user's switch for one event and channel. No row means the default (on)."""

    __tablename__ = "notification_preferences"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    event = Column(String(40), nullable=False)
    channel = Column(String(10), nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", "event", "channel", name="uq_notification_preferences_user_event_channel"),
    )

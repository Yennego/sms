"""Platform billing (docs/remodel/phase7-design.md §3): what schools pay the platform.

These are platform tables: each row names its school, but only user_activity_months has row level
security (sign-in writes it bound to the school). School endpoints filter by the request's school.
Money is NUMERIC(12,2) and Decimal; USD and LRD are never added together. Balances are calculated
from lines and payments that are not void, never stored. Nothing cascades on delete.
"""
import uuid
from datetime import datetime, UTC

from sqlalchemy import (
    Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text,
    UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.db.models.base import Base

SUBSCRIPTION_STATUSES = ("trial", "active", "read_only", "suspended", "dormant")
LINE_KINDS = ("staff", "family", "minimum", "first_term_free", "adjustment")
PAYMENT_METHODS = ("bank", "mobile_money", "cash", "online")
REMINDER_KINDS = ("due", "due_7", "due_14", "read_only", "suspended")

Money = Numeric(12, 2)


def _now():
    return datetime.now(UTC)


class PlatformPrice(Base):
    """One price list, in force from effective_from until the next one. Never edited: a change of
    price is a new row, so issued invoices keep pointing at the prices they used."""

    __tablename__ = "platform_prices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    effective_from = Column(Date, nullable=False)
    staff_per_month_usd = Column(Money, nullable=False)
    staff_per_month_lrd = Column(Money, nullable=False)
    family_per_month_usd = Column(Money, nullable=False)
    family_per_month_lrd = Column(Money, nullable=False)
    term_minimum_usd = Column(Money, nullable=False)
    term_minimum_lrd = Column(Money, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    __table_args__ = (
        UniqueConstraint("effective_from", name="uq_platform_prices_effective_from"),
        CheckConstraint("staff_per_month_usd >= 0 AND staff_per_month_lrd >= 0 AND family_per_month_usd >= 0 "
                        "AND family_per_month_lrd >= 0 AND term_minimum_usd >= 0 AND term_minimum_lrd >= 0",
                        name="ck_platform_prices_not_negative"),
    )


class PlatformCounter(Base):
    """The last invoice (PINV) or receipt (PRCPT) number given out per year (locked while numbering)."""

    __tablename__ = "platform_counters"

    name = Column(String(10), primary_key=True)
    year = Column(Integer, primary_key=True)
    last_number = Column(Integer, nullable=False, default=0)


class SchoolSubscription(Base):
    """A school's access state, set by the daily job (or the operator) with its reason and date.
    The API reads it on every request; it never recomputes it."""

    __tablename__ = "school_subscriptions"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="RESTRICT"), primary_key=True)
    status = Column(String(12), nullable=False, default="trial")
    status_since = Column(DateTime(timezone=True), nullable=False, default=_now)
    status_reason = Column(Text, nullable=True)
    # Until this date (inclusive) the school's status doesn't get worse
    grace_until = Column(Date, nullable=True)
    first_term_free_used = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    __table_args__ = (
        CheckConstraint("status IN ('trial', 'active', 'read_only', 'suspended', 'dormant')",
                        name="ck_school_subscriptions_status"),
        Index("ix_school_subscriptions_status", "status"),
    )


class PlatformInvoice(Base):
    """A school's bill for one semester, priced in USD and LRD; the first payment fixes the currency."""

    __tablename__ = "platform_invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False)
    number = Column(String(20), nullable=False)
    semester_id = Column(UUID(as_uuid=True), ForeignKey("semesters.id"), nullable=False)
    price_id = Column(UUID(as_uuid=True), ForeignKey("platform_prices.id"), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    issued_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    issued_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # empty: the daily job
    due_date = Column(Date, nullable=False)
    currency = Column(String(3), nullable=True)
    status = Column(String(10), nullable=False, default="issued")
    void_reason = Column(Text, nullable=True)
    voided_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    voided_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    lines = relationship("PlatformInvoiceLine", order_by="PlatformInvoiceLine.created_at")

    __table_args__ = (
        UniqueConstraint("number", name="uq_platform_invoices_number"),
        CheckConstraint("status IN ('issued', 'void')", name="ck_platform_invoices_status"),
        CheckConstraint("currency IS NULL OR currency IN ('USD', 'LRD')", name="ck_platform_invoices_currency"),
        Index("uq_platform_invoices_semester", "tenant_id", "semester_id", unique=True,
              postgresql_where=text("status = 'issued'"), sqlite_where=text("status = 'issued'")),
        Index("ix_platform_invoices_tenant", "tenant_id", "issued_at"),
    )


class PlatformInvoiceLine(Base):
    """staff, family, minimum (top-up to the term minimum), first_term_free (negative) or adjustment."""

    __tablename__ = "platform_invoice_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("platform_invoices.id"), nullable=False)
    kind = Column(String(20), nullable=False)
    description = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_usd = Column(Money, nullable=False)
    unit_lrd = Column(Money, nullable=False)
    amount_usd = Column(Money, nullable=False)
    amount_lrd = Column(Money, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    __table_args__ = (
        CheckConstraint("kind IN ('staff', 'family', 'minimum', 'first_term_free', 'adjustment')",
                        name="ck_platform_invoice_lines_kind"),
        Index("ix_platform_invoice_lines_invoice", "invoice_id"),
    )


class PlatformPayment(Base):
    """Money a school paid on an invoice, with its receipt number. Online payments name their
    provider and the provider's reference (recorded once)."""

    __tablename__ = "platform_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("platform_invoices.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False)
    receipt_number = Column(String(20), nullable=False)
    amount = Column(Money, nullable=False)
    currency = Column(String(3), nullable=False)
    method = Column(String(20), nullable=False)
    reference = Column(String(100), nullable=True)
    provider = Column(String(30), nullable=True)
    provider_ref = Column(String(100), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    voided_at = Column(DateTime(timezone=True), nullable=True)
    voided_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    void_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    __table_args__ = (
        UniqueConstraint("receipt_number", name="uq_platform_payments_receipt_number"),
        CheckConstraint("amount > 0", name="ck_platform_payments_amount"),
        CheckConstraint("currency IN ('USD', 'LRD')", name="ck_platform_payments_currency"),
        CheckConstraint("method IN ('bank', 'mobile_money', 'cash', 'online')", name="ck_platform_payments_method"),
        Index("ix_platform_payments_invoice", "invoice_id"),
        Index("ix_platform_payments_tenant", "tenant_id", "received_at"),
        Index("uq_platform_payments_provider_ref", "provider", "provider_ref", unique=True,
              postgresql_where=text("provider_ref IS NOT NULL"), sqlite_where=text("provider_ref IS NOT NULL")),
    )


class PlatformReminder(Base):
    """A reminder sent to a school's admins about an invoice; each kind is sent once."""

    __tablename__ = "platform_reminders"

    invoice_id = Column(UUID(as_uuid=True), ForeignKey("platform_invoices.id"), primary_key=True)
    kind = Column(String(12), primary_key=True)
    sent_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    __table_args__ = (
        CheckConstraint("kind IN ('due', 'due_7', 'due_14', 'read_only', 'suspended')", name="ck_platform_reminders_kind"),
    )


class UserActivityMonth(Base):
    """A month (its first day) in which the user signed in or refreshed a session. Parents and
    students are billed for these months only."""

    __tablename__ = "user_activity_months"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="RESTRICT"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    month = Column(Date, primary_key=True)

    __table_args__ = (
        Index("ix_user_activity_months_month", "tenant_id", "month"),
    )


class PlatformPaymentDetails(Base):
    """How schools pay the platform (bank, mobile money numbers...), as the operator writes it.
    One row (id 1); schools see it on their Billing page, or "contact the platform" while empty."""

    __tablename__ = "platform_payment_details"

    id = Column(Integer, primary_key=True)
    instructions = Column(Text, nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    __table_args__ = (CheckConstraint("id = 1", name="ck_platform_payment_details_single_row"),)

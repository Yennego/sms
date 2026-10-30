"""School fees (docs/remodel/phase5-design.md §3): schedules, installment plans, student accounts,
invoices, adjustments, payments with receipts, and the school's finance settings.

Money is NUMERIC(12,2) and Decimal. Balances are never stored: they are calculated from invoice
lines, adjustments and the allocations of payments that are not void (services/finance/ledger.py).
Nothing here cascades on delete: payment history is never removed.
"""
from datetime import datetime, UTC

from sqlalchemy import (
    Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text,
    UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.db.models.base import TenantModel

CURRENCIES = ("USD", "LRD")
PAYMENT_METHODS = ("cash", "bank", "mobile_money")
ADJUSTMENT_KINDS = ("discount", "scholarship", "waiver")
INVOICE_STATUSES = ("issued", "void")

Money = Numeric(12, 2)


def _now():
    return datetime.now(UTC)


class FeeSchedule(TenantModel):
    """What a grade level (or every grade level, grade_id NULL) pays for a fee category in one
    semester, in USD and/or LRD."""

    __tablename__ = "fee_schedules"

    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    semester_id = Column(UUID(as_uuid=True), ForeignKey("semesters.id"), nullable=False)
    grade_id = Column(UUID(as_uuid=True), ForeignKey("academic_grades.id"), nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("fee_categories.id"), nullable=False)
    amount_usd = Column(Money, nullable=True)
    amount_lrd = Column(Money, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "academic_year_id", "semester_id", "grade_id", "category_id",
                         name="uq_fee_schedules_year_semester_grade_category", postgresql_nulls_not_distinct=True),
        CheckConstraint("amount_usd IS NOT NULL OR amount_lrd IS NOT NULL", name="ck_fee_schedules_amount"),
        CheckConstraint("(amount_usd IS NULL OR amount_usd >= 0) AND (amount_lrd IS NULL OR amount_lrd >= 0)",
                        name="ck_fee_schedules_amount_not_negative"),
        Index("ix_fee_schedules_semester", "tenant_id", "semester_id"),
    )


class InstallmentPlan(TenantModel):
    """One due date of a semester's installment plan: by due_date, `percent` more of the
    semester's bill is due. A semester's percents add up to 100."""

    __tablename__ = "installment_plans"

    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    semester_id = Column(UUID(as_uuid=True), ForeignKey("semesters.id"), nullable=False)
    sequence = Column(Integer, nullable=False)
    due_date = Column(Date, nullable=False)
    percent = Column(Numeric(5, 2), nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "semester_id", "sequence", name="uq_installment_plans_semester_sequence"),
        CheckConstraint("percent > 0 AND percent <= 100", name="ck_installment_plans_percent"),
    )


class StudentFeeAccount(TenantModel):
    """A student's fees for one school year. The first payment fixes the currency."""

    __tablename__ = "student_fee_accounts"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    currency = Column(String(3), nullable=True)
    currency_locked_at = Column(DateTime(timezone=True), nullable=True)
    report_card_hold_override = Column(Boolean, nullable=False, default=False, server_default=text("false"))

    invoices = relationship("Invoice", back_populates="account", order_by="Invoice.issued_at")

    __table_args__ = (
        UniqueConstraint("tenant_id", "student_id", "academic_year_id", name="uq_student_fee_accounts_student_year"),
        CheckConstraint("currency IS NULL OR currency IN ('USD', 'LRD')", name="ck_student_fee_accounts_currency"),
        Index("ix_student_fee_accounts_year", "tenant_id", "academic_year_id"),
    )


class Invoice(TenantModel):
    """A student's bill for one semester."""

    __tablename__ = "invoices"

    account_id = Column(UUID(as_uuid=True), ForeignKey("student_fee_accounts.id"), nullable=False)
    semester_id = Column(UUID(as_uuid=True), ForeignKey("semesters.id"), nullable=False)
    status = Column(String(10), nullable=False, default="issued")
    issued_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    issued_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    voided_at = Column(DateTime(timezone=True), nullable=True)
    voided_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    void_reason = Column(Text, nullable=True)

    account = relationship("StudentFeeAccount", back_populates="invoices")
    lines = relationship("InvoiceLine", back_populates="invoice", order_by="InvoiceLine.created_at")
    adjustments = relationship("FeeAdjustment", back_populates="invoice", order_by="FeeAdjustment.created_at")

    __table_args__ = (
        UniqueConstraint("tenant_id", "account_id", "semester_id", name="uq_invoices_account_semester"),
        CheckConstraint("status IN ('issued', 'void')", name="ck_invoices_status"),
    )


class InvoiceLine(TenantModel):
    __tablename__ = "invoice_lines"

    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    schedule_id = Column(UUID(as_uuid=True), ForeignKey("fee_schedules.id"), nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("fee_categories.id"), nullable=False)
    description = Column(String(255), nullable=False)
    amount_usd = Column(Money, nullable=True)
    amount_lrd = Column(Money, nullable=True)

    invoice = relationship("Invoice", back_populates="lines")

    __table_args__ = (
        CheckConstraint("amount_usd IS NOT NULL OR amount_lrd IS NOT NULL", name="ck_invoice_lines_amount"),
        Index("uq_invoice_lines_invoice_schedule", "tenant_id", "invoice_id", "schedule_id", unique=True,
              postgresql_where=text("schedule_id IS NOT NULL"), sqlite_where=text("schedule_id IS NOT NULL")),
        Index("ix_invoice_lines_invoice", "tenant_id", "invoice_id"),
    )


class FeeAdjustment(TenantModel):
    """A discount, scholarship or waiver on an invoice: a percent of its lines, or fixed amounts."""

    __tablename__ = "fee_adjustments"

    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    kind = Column(String(20), nullable=False)
    percent = Column(Numeric(5, 2), nullable=True)
    amount_usd = Column(Money, nullable=True)
    amount_lrd = Column(Money, nullable=True)
    reason = Column(Text, nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    invoice = relationship("Invoice", back_populates="adjustments")

    __table_args__ = (
        CheckConstraint("kind IN ('discount', 'scholarship', 'waiver')", name="ck_fee_adjustments_kind"),
        CheckConstraint("(percent IS NOT NULL AND amount_usd IS NULL AND amount_lrd IS NULL AND percent > 0 AND percent <= 100)"
                        " OR (percent IS NULL AND (amount_usd IS NOT NULL OR amount_lrd IS NOT NULL))",
                        name="ck_fee_adjustments_value"),
    )


class Payment(TenantModel):
    """Money received, with its receipt number (school year start year + sequence)."""

    __tablename__ = "payments"

    account_id = Column(UUID(as_uuid=True), ForeignKey("student_fee_accounts.id"), nullable=False)
    receipt_year = Column(Integer, nullable=False)
    receipt_seq = Column(Integer, nullable=False)
    receipt_number = Column(String(20), nullable=False)
    amount = Column(Money, nullable=False)
    currency = Column(String(3), nullable=False)
    method = Column(String(20), nullable=False)
    reference = Column(String(100), nullable=True)
    note = Column(Text, nullable=True)
    received_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    voided_at = Column(DateTime(timezone=True), nullable=True)
    voided_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    void_reason = Column(Text, nullable=True)
    # Balance in this currency right after the payment, as printed on the receipt (NULL for
    # payments moved from the old tables)
    balance_after = Column(Money, nullable=True)

    allocations = relationship("PaymentAllocation", back_populates="payment")

    __table_args__ = (
        UniqueConstraint("tenant_id", "receipt_number", name="uq_payments_receipt_number"),
        UniqueConstraint("tenant_id", "receipt_year", "receipt_seq", name="uq_payments_receipt_seq"),
        CheckConstraint("amount > 0", name="ck_payments_amount"),
        CheckConstraint("currency IN ('USD', 'LRD')", name="ck_payments_currency"),
        CheckConstraint("method IN ('cash', 'bank', 'mobile_money')", name="ck_payments_method"),
        Index("ix_payments_account", "tenant_id", "account_id"),
        Index("ix_payments_received_at", "tenant_id", "received_at"),
    )


class PaymentAllocation(TenantModel):
    __tablename__ = "payment_allocations"

    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=False)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    amount = Column(Money, nullable=False)

    payment = relationship("Payment", back_populates="allocations")

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_payment_allocations_amount"),
        Index("ix_payment_allocations_invoice", "tenant_id", "invoice_id"),
        Index("ix_payment_allocations_payment", "tenant_id", "payment_id"),
    )


class ReceiptCounter(TenantModel):
    """The last receipt number given out per school and receipt year (locked while numbering)."""

    __tablename__ = "receipt_counters"

    year = Column(Integer, nullable=False)
    last_number = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("tenant_id", "year", name="uq_receipt_counters_year"),
    )


class FinanceSettings(TenantModel):
    __tablename__ = "finance_settings"

    hold_report_cards_on_arrears = Column(Boolean, nullable=False, default=False, server_default=text("false"))

    __table_args__ = (
        UniqueConstraint("tenant_id", name="uq_finance_settings_tenant"),
    )

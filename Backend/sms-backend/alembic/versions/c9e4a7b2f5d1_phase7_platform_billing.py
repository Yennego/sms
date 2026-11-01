"""
phase7_platform_billing

Platform billing (docs/remodel/phase7-design.md §3).

1. New platform tables (no row level security: like tenants and users, they belong to the
   platform; school endpoints filter by school): platform_prices, platform_counters (invoice and
   receipt numbers, locked while numbering), school_subscriptions (one per school),
   platform_invoices, platform_invoice_lines, platform_payments, platform_reminders. Nothing
   cascades on delete.
2. user_activity_months (one row per user and month signed in), with a composite tenant key to
   users and row level security: sign-in writes it bound to the user's school.
3. A school_subscriptions row per existing school, from tenants.subscription_status:
   active -> active; past_due -> active (no invoice exists under the new rules, so there is
   nothing to be overdue on); canceled -> dormant; anything else -> active. first_term_free_used
   is false: the pilot schools' first platform invoice is free, like a new school's.
4. tenants.plan_type, plan_amount and subscription_status are dropped.

Downgrade puts the three tenants columns back (plan_type flat_rate and plan_amount 0: the old
plan amounts are not kept; subscription_status from the subscription: dormant -> canceled,
read_only/suspended -> past_due, otherwise active) and drops the new tables with their data.

Revision ID: c9e4a7b2f5d1
Revises: b6f2d9a4e8c1
Create Date: 2026-11-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = 'c9e4a7b2f5d1'
down_revision = 'b6f2d9a4e8c1'
branch_labels = None
depends_on = None

TAG = "[phase7_platform_billing]"
RLS_CHECK = (
    "(current_setting('app.bypass_rls', true) = 'on' "
    "OR tenant_id::text = current_setting('app.tenant_id', true))"
)
NEW_TABLES = ("user_activity_months", "platform_reminders", "platform_payments", "platform_invoice_lines",
              "platform_invoices", "school_subscriptions", "platform_counters", "platform_prices")
OLD_STATUS = {"active": "active", "past_due": "active", "canceled": "dormant"}


def _bypass_rls(bind):
    bind.execute(sa.text("SELECT set_config('app.bypass_rls', 'on', true)"))


def _enable_rls(table):
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY tenant_isolation ON {table} USING {RLS_CHECK} WITH CHECK {RLS_CHECK}")


def _money(name, nullable=False):
    return sa.Column(name, sa.Numeric(12, 2), nullable=nullable)


def _user(name):
    return sa.Column(name, UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True)


def _created():
    return sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())


def _create_tables():
    op.create_table(
        'platform_prices',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('effective_from', sa.Date(), nullable=False),
        _money('staff_per_month_usd'), _money('staff_per_month_lrd'),
        _money('family_per_month_usd'), _money('family_per_month_lrd'),
        _money('term_minimum_usd'), _money('term_minimum_lrd'),
        _user('created_by'),
        _created(),
        sa.UniqueConstraint('effective_from', name='uq_platform_prices_effective_from'),
        sa.CheckConstraint('staff_per_month_usd >= 0 AND staff_per_month_lrd >= 0 AND family_per_month_usd >= 0 '
                           'AND family_per_month_lrd >= 0 AND term_minimum_usd >= 0 AND term_minimum_lrd >= 0',
                           name='ck_platform_prices_not_negative'))

    op.create_table(
        'platform_counters',
        sa.Column('name', sa.String(10), primary_key=True),
        sa.Column('year', sa.Integer(), primary_key=True),
        sa.Column('last_number', sa.Integer(), nullable=False, server_default='0'))

    op.create_table(
        'school_subscriptions',
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), primary_key=True),
        sa.Column('status', sa.String(12), nullable=False),
        sa.Column('status_since', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('status_reason', sa.Text(), nullable=True),
        sa.Column('grace_until', sa.Date(), nullable=True),
        sa.Column('first_term_free_used', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        _created(),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('trial', 'active', 'read_only', 'suspended', 'dormant')",
                           name='ck_school_subscriptions_status'))
    op.create_index('ix_school_subscriptions_status', 'school_subscriptions', ['status'])

    op.create_table(
        'platform_invoices',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('number', sa.String(20), nullable=False),
        sa.Column('semester_id', UUID(as_uuid=True), nullable=False),
        sa.Column('price_id', UUID(as_uuid=True), sa.ForeignKey('platform_prices.id'), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False),
        _user('issued_by'),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('currency', sa.String(3), nullable=True),
        sa.Column('status', sa.String(10), nullable=False, server_default='issued'),
        sa.Column('void_reason', sa.Text(), nullable=True),
        _user('voided_by'),
        sa.Column('voided_at', sa.DateTime(timezone=True), nullable=True),
        _created(),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        # The semester must be the invoiced school's own
        sa.ForeignKeyConstraint(['tenant_id', 'semester_id'], ['semesters.tenant_id', 'semesters.id'],
                                name='fk_tn_platform_invoices_semester_id', ondelete='RESTRICT'),
        sa.UniqueConstraint('number', name='uq_platform_invoices_number'),
        sa.CheckConstraint("status IN ('issued', 'void')", name='ck_platform_invoices_status'),
        sa.CheckConstraint("currency IS NULL OR currency IN ('USD', 'LRD')", name='ck_platform_invoices_currency'))
    # One live invoice per school and semester (a void one can be issued again)
    op.create_index('uq_platform_invoices_semester', 'platform_invoices', ['tenant_id', 'semester_id'], unique=True,
                    postgresql_where=sa.text("status = 'issued'"))
    op.create_index('ix_platform_invoices_tenant', 'platform_invoices', ['tenant_id', 'issued_at'])

    op.create_table(
        'platform_invoice_lines',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('invoice_id', UUID(as_uuid=True), sa.ForeignKey('platform_invoices.id'), nullable=False),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('description', sa.String(255), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        _money('unit_usd'), _money('unit_lrd'), _money('amount_usd'), _money('amount_lrd'),
        _created(),
        sa.CheckConstraint("kind IN ('staff', 'family', 'minimum', 'first_term_free', 'adjustment')",
                           name='ck_platform_invoice_lines_kind'))
    op.create_index('ix_platform_invoice_lines_invoice', 'platform_invoice_lines', ['invoice_id'])

    op.create_table(
        'platform_payments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('invoice_id', UUID(as_uuid=True), sa.ForeignKey('platform_invoices.id'), nullable=False),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('receipt_number', sa.String(20), nullable=False),
        _money('amount'),
        sa.Column('currency', sa.String(3), nullable=False),
        sa.Column('method', sa.String(20), nullable=False),
        sa.Column('reference', sa.String(100), nullable=True),
        sa.Column('provider', sa.String(30), nullable=True),
        sa.Column('provider_ref', sa.String(100), nullable=True),
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=False),
        _user('recorded_by'),
        sa.Column('voided_at', sa.DateTime(timezone=True), nullable=True),
        _user('voided_by'),
        sa.Column('void_reason', sa.Text(), nullable=True),
        _created(),
        sa.UniqueConstraint('receipt_number', name='uq_platform_payments_receipt_number'),
        sa.CheckConstraint('amount > 0', name='ck_platform_payments_amount'),
        sa.CheckConstraint("currency IN ('USD', 'LRD')", name='ck_platform_payments_currency'),
        sa.CheckConstraint("method IN ('bank', 'mobile_money', 'cash', 'online')", name='ck_platform_payments_method'))
    op.create_index('ix_platform_payments_invoice', 'platform_payments', ['invoice_id'])
    op.create_index('ix_platform_payments_tenant', 'platform_payments', ['tenant_id', 'received_at'])
    # A provider's notification is recorded once
    op.create_index('uq_platform_payments_provider_ref', 'platform_payments', ['provider', 'provider_ref'], unique=True,
                    postgresql_where=sa.text('provider_ref IS NOT NULL'))

    op.create_table(
        'platform_reminders',
        sa.Column('invoice_id', UUID(as_uuid=True), sa.ForeignKey('platform_invoices.id'), primary_key=True),
        sa.Column('kind', sa.String(12), primary_key=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("kind IN ('due', 'due_7', 'due_14', 'read_only', 'suspended')",
                           name='ck_platform_reminders_kind'))

    op.create_table(
        'user_activity_months',
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), primary_key=True),
        sa.Column('month', sa.Date(), primary_key=True),
        # A deleted account takes its usage with it; invoices already issued keep their counts
        sa.ForeignKeyConstraint(['tenant_id', 'user_id'], ['users.tenant_id', 'users.id'],
                                name='fk_tn_user_activity_months_user_id', ondelete='CASCADE'),
        sa.CheckConstraint('EXTRACT(DAY FROM month) = 1', name='ck_user_activity_months_first_day'))
    op.create_index('ix_user_activity_months_month', 'user_activity_months', ['tenant_id', 'month'])
    _enable_rls('user_activity_months')


def upgrade() -> None:
    bind = op.get_bind()
    _bypass_rls(bind)

    _create_tables()

    tenants = bind.execute(sa.text("SELECT id, name, subscription_status FROM tenants ORDER BY name")).mappings().all()
    counts = {}
    for t in tenants:
        old = t["subscription_status"]
        status = OLD_STATUS.get(old, "active")
        bind.execute(sa.text("""
            INSERT INTO school_subscriptions (tenant_id, status, status_since, status_reason, first_term_free_used,
                                              created_at, updated_at)
            VALUES (:t, :s, now(), :reason, false, now(), now())
        """), {"t": t["id"], "s": status, "reason": f"Moved from the old plan (subscription_status {old})"})
        counts[f"{old} -> {status}"] = counts.get(f"{old} -> {status}", 0) + 1
    print(f"{TAG} school_subscriptions: {len(tenants)} schools ("
          + (", ".join(f"{k}: {v}" for k, v in sorted(counts.items())) or "none") + ")")

    for column in ("plan_type", "plan_amount", "subscription_status"):
        op.drop_column('tenants', column)
    print(f"{TAG} tenants.plan_type, plan_amount and subscription_status dropped")


def downgrade() -> None:
    bind = op.get_bind()
    _bypass_rls(bind)

    op.add_column('tenants', sa.Column('plan_type', sa.String(20), nullable=False, server_default='flat_rate',
                                       comment="'flat_rate' or 'per_user'"))
    op.add_column('tenants', sa.Column('plan_amount', sa.Numeric(10, 2), nullable=False, server_default='0.0',
                                       comment='Monthly amount based on plan_type'))
    op.add_column('tenants', sa.Column('subscription_status', sa.String(20), nullable=False, server_default='active',
                                       comment="'active', 'past_due', 'canceled'"))
    bind.execute(sa.text("""
        UPDATE tenants t SET subscription_status = CASE s.status
            WHEN 'dormant' THEN 'canceled' WHEN 'read_only' THEN 'past_due' WHEN 'suspended' THEN 'past_due'
            ELSE 'active' END
        FROM school_subscriptions s WHERE s.tenant_id = t.id
    """))
    invoices = bind.execute(sa.text("SELECT count(*) FROM platform_invoices")).scalar()
    payments = bind.execute(sa.text("SELECT count(*) FROM platform_payments")).scalar()
    print(f"{TAG} downgrade: tenants columns restored (plan amounts reset to 0); "
          f"{invoices} platform invoices and {payments} payments dropped")

    for table in NEW_TABLES:
        op.drop_table(table)

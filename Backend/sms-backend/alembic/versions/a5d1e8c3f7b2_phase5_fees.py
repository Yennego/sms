"""
phase5_fees

School fees and the parent portal (docs/remodel/phase5-design.md §3-§4).

1. fee_categories gains is_active.
2. New tables, with composite tenant keys (fk_tn_/uq_tn_) and row level security: fee_schedules,
   installment_plans, student_fee_accounts, invoices, invoice_lines, fee_adjustments, payments,
   payment_allocations, receipt_counters, finance_settings. Nothing cascades on delete.
3. parent_student gains tenant_id (the student's school) with composite keys to students and
   users. Links between two schools (none expected) are reported and removed.
4. Today's data moves across:
   - fee_structures -> fee_schedules in USD; the semester is the one of the year containing the
     due date (else the nearest one, reported);
   - student_fees -> an account per student and year, an invoice per semester, one line each
     (amount = the fee's total_amount);
   - fee_payments -> payments in USD, receipt numbers per school and school year in date order,
     allocated to their fee's invoice up to what it still owes (any excess stays unallocated and
     is reported); the account's currency is locked to USD;
   - fee_installments -> an installment plan per semester when every fee of that semester has the
     same due dates and shares; otherwise one installment at the semester's end (reported).
5. Permissions record_payments, create_invoices, approve_financial_transactions and
   generate_financial_reports for the admin system role.
6. The old tables (fee_payments, fee_installments, student_fees, fee_structures) are dropped.

Downgrade recreates the old tables EMPTY (the moved data is not copied back), drops the new tables
and parent_student.tenant_id, and takes back record_payments, create_invoices and
approve_financial_transactions from admin (generate_financial_reports was already granted).

Revision ID: a5d1e8c3f7b2
Revises: c8a4f1e6d2b9
Create Date: 2026-10-30 12:00:00.000000

"""
import uuid
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = 'a5d1e8c3f7b2'
down_revision = 'c8a4f1e6d2b9'
branch_labels = None
depends_on = None

TAG = "[phase5_fees]"
RLS_CHECK = (
    "(current_setting('app.bypass_rls', true) = 'on' "
    "OR tenant_id::text = current_setting('app.tenant_id', true))"
)
CENT = Decimal("0.01")
NEW_TABLES = ("finance_settings", "receipt_counters", "payment_allocations", "payments", "fee_adjustments",
              "invoice_lines", "invoices", "student_fee_accounts", "installment_plans", "fee_schedules")
GRANTED = ("record_payments", "create_invoices", "approve_financial_transactions", "generate_financial_reports")
REVOKE_ON_DOWNGRADE = ("record_payments", "create_invoices", "approve_financial_transactions")


def _bypass_rls(bind):
    bind.execute(sa.text("SELECT set_config('app.bypass_rls', 'on', true)"))


def _rows(bind, sql, **params):
    return bind.execute(sa.text(sql), params).mappings().all()


def _enable_rls(table):
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY tenant_isolation ON {table} USING {RLS_CHECK} WITH CHECK {RLS_CHECK}")


def _base(table, *columns, **kw):
    """id, tenant_id, timestamps, the composite key target and the given columns."""
    return op.create_table(
        table,
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False),
        *columns,
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('tenant_id', 'id', name=f'uq_tn_{table}'),
        **kw,
    )


def _fk(table, column, target):
    return sa.ForeignKeyConstraint(['tenant_id', column], [f'{target}.tenant_id', f'{target}.id'],
                                   name=f'fk_tn_{table}_{column}', ondelete='RESTRICT')


def _money(name, nullable=True):
    return sa.Column(name, sa.Numeric(12, 2), nullable=nullable)


def _report(kind, rows, reason):
    if rows:
        print(f"{TAG} {len(rows)} {kind} ({reason}): " + ", ".join(str(r) for r in rows[:50])
              + (" ..." if len(rows) > 50 else ""))


def _create_tables():
    _base('fee_schedules',
          sa.Column('academic_year_id', UUID(as_uuid=True), nullable=False),
          sa.Column('semester_id', UUID(as_uuid=True), nullable=False),
          sa.Column('grade_id', UUID(as_uuid=True), nullable=True),
          sa.Column('category_id', UUID(as_uuid=True), nullable=False),
          _money('amount_usd'), _money('amount_lrd'),
          _fk('fee_schedules', 'academic_year_id', 'academic_years'),
          _fk('fee_schedules', 'semester_id', 'semesters'),
          _fk('fee_schedules', 'grade_id', 'academic_grades'),
          _fk('fee_schedules', 'category_id', 'fee_categories'),
          sa.UniqueConstraint('tenant_id', 'academic_year_id', 'semester_id', 'grade_id', 'category_id',
                              name='uq_fee_schedules_year_semester_grade_category', postgresql_nulls_not_distinct=True),
          sa.CheckConstraint('amount_usd IS NOT NULL OR amount_lrd IS NOT NULL', name='ck_fee_schedules_amount'),
          sa.CheckConstraint('(amount_usd IS NULL OR amount_usd >= 0) AND (amount_lrd IS NULL OR amount_lrd >= 0)',
                             name='ck_fee_schedules_amount_not_negative'))
    op.create_index('ix_fee_schedules_semester', 'fee_schedules', ['tenant_id', 'semester_id'])

    _base('installment_plans',
          sa.Column('academic_year_id', UUID(as_uuid=True), nullable=False),
          sa.Column('semester_id', UUID(as_uuid=True), nullable=False),
          sa.Column('sequence', sa.Integer(), nullable=False),
          sa.Column('due_date', sa.Date(), nullable=False),
          sa.Column('percent', sa.Numeric(5, 2), nullable=False),
          _fk('installment_plans', 'academic_year_id', 'academic_years'),
          _fk('installment_plans', 'semester_id', 'semesters'),
          sa.UniqueConstraint('tenant_id', 'semester_id', 'sequence', name='uq_installment_plans_semester_sequence'),
          sa.CheckConstraint('percent > 0 AND percent <= 100', name='ck_installment_plans_percent'))

    _base('student_fee_accounts',
          sa.Column('student_id', UUID(as_uuid=True), nullable=False),
          sa.Column('academic_year_id', UUID(as_uuid=True), nullable=False),
          sa.Column('currency', sa.String(3), nullable=True),
          sa.Column('currency_locked_at', sa.DateTime(timezone=True), nullable=True),
          sa.Column('report_card_hold_override', sa.Boolean(), nullable=False, server_default=sa.text('false')),
          _fk('student_fee_accounts', 'student_id', 'students'),
          _fk('student_fee_accounts', 'academic_year_id', 'academic_years'),
          sa.UniqueConstraint('tenant_id', 'student_id', 'academic_year_id', name='uq_student_fee_accounts_student_year'),
          sa.CheckConstraint("currency IS NULL OR currency IN ('USD', 'LRD')", name='ck_student_fee_accounts_currency'))
    op.create_index('ix_student_fee_accounts_year', 'student_fee_accounts', ['tenant_id', 'academic_year_id'])

    _base('invoices',
          sa.Column('account_id', UUID(as_uuid=True), nullable=False),
          sa.Column('semester_id', UUID(as_uuid=True), nullable=False),
          sa.Column('status', sa.String(10), nullable=False, server_default='issued'),
          sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
          sa.Column('issued_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
          sa.Column('voided_at', sa.DateTime(timezone=True), nullable=True),
          sa.Column('voided_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
          sa.Column('void_reason', sa.Text(), nullable=True),
          _fk('invoices', 'account_id', 'student_fee_accounts'),
          _fk('invoices', 'semester_id', 'semesters'),
          sa.UniqueConstraint('tenant_id', 'account_id', 'semester_id', name='uq_invoices_account_semester'),
          sa.CheckConstraint("status IN ('issued', 'void')", name='ck_invoices_status'))

    _base('invoice_lines',
          sa.Column('invoice_id', UUID(as_uuid=True), nullable=False),
          sa.Column('schedule_id', UUID(as_uuid=True), nullable=True),
          sa.Column('category_id', UUID(as_uuid=True), nullable=False),
          sa.Column('description', sa.String(255), nullable=False),
          _money('amount_usd'), _money('amount_lrd'),
          _fk('invoice_lines', 'invoice_id', 'invoices'),
          _fk('invoice_lines', 'schedule_id', 'fee_schedules'),
          _fk('invoice_lines', 'category_id', 'fee_categories'),
          sa.CheckConstraint('amount_usd IS NOT NULL OR amount_lrd IS NOT NULL', name='ck_invoice_lines_amount'))
    op.create_index('uq_invoice_lines_invoice_schedule', 'invoice_lines', ['tenant_id', 'invoice_id', 'schedule_id'],
                    unique=True, postgresql_where=sa.text('schedule_id IS NOT NULL'))
    op.create_index('ix_invoice_lines_invoice', 'invoice_lines', ['tenant_id', 'invoice_id'])

    _base('fee_adjustments',
          sa.Column('invoice_id', UUID(as_uuid=True), nullable=False),
          sa.Column('kind', sa.String(20), nullable=False),
          sa.Column('percent', sa.Numeric(5, 2), nullable=True),
          _money('amount_usd'), _money('amount_lrd'),
          sa.Column('reason', sa.Text(), nullable=False),
          sa.Column('approved_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
          _fk('fee_adjustments', 'invoice_id', 'invoices'),
          sa.CheckConstraint("kind IN ('discount', 'scholarship', 'waiver')", name='ck_fee_adjustments_kind'),
          sa.CheckConstraint("(percent IS NOT NULL AND amount_usd IS NULL AND amount_lrd IS NULL AND percent > 0 AND percent <= 100)"
                             " OR (percent IS NULL AND (amount_usd IS NOT NULL OR amount_lrd IS NOT NULL))",
                             name='ck_fee_adjustments_value'))

    _base('payments',
          sa.Column('account_id', UUID(as_uuid=True), nullable=False),
          sa.Column('receipt_year', sa.Integer(), nullable=False),
          sa.Column('receipt_seq', sa.Integer(), nullable=False),
          sa.Column('receipt_number', sa.String(20), nullable=False),
          _money('amount', nullable=False),
          sa.Column('currency', sa.String(3), nullable=False),
          sa.Column('method', sa.String(20), nullable=False),
          sa.Column('reference', sa.String(100), nullable=True),
          sa.Column('note', sa.Text(), nullable=True),
          sa.Column('received_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
          sa.Column('received_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
          sa.Column('voided_at', sa.DateTime(timezone=True), nullable=True),
          sa.Column('voided_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
          sa.Column('void_reason', sa.Text(), nullable=True),
          _fk('payments', 'account_id', 'student_fee_accounts'),
          sa.UniqueConstraint('tenant_id', 'receipt_number', name='uq_payments_receipt_number'),
          sa.UniqueConstraint('tenant_id', 'receipt_year', 'receipt_seq', name='uq_payments_receipt_seq'),
          sa.CheckConstraint('amount > 0', name='ck_payments_amount'),
          sa.CheckConstraint("currency IN ('USD', 'LRD')", name='ck_payments_currency'),
          sa.CheckConstraint("method IN ('cash', 'bank', 'mobile_money')", name='ck_payments_method'))
    op.create_index('ix_payments_account', 'payments', ['tenant_id', 'account_id'])
    op.create_index('ix_payments_received_at', 'payments', ['tenant_id', 'received_at'])

    _base('payment_allocations',
          sa.Column('payment_id', UUID(as_uuid=True), nullable=False),
          sa.Column('invoice_id', UUID(as_uuid=True), nullable=False),
          _money('amount', nullable=False),
          _fk('payment_allocations', 'payment_id', 'payments'),
          _fk('payment_allocations', 'invoice_id', 'invoices'),
          sa.CheckConstraint('amount > 0', name='ck_payment_allocations_amount'))
    op.create_index('ix_payment_allocations_invoice', 'payment_allocations', ['tenant_id', 'invoice_id'])
    op.create_index('ix_payment_allocations_payment', 'payment_allocations', ['tenant_id', 'payment_id'])

    _base('receipt_counters',
          sa.Column('year', sa.Integer(), nullable=False),
          sa.Column('last_number', sa.Integer(), nullable=False, server_default='0'),
          sa.UniqueConstraint('tenant_id', 'year', name='uq_receipt_counters_year'))

    _base('finance_settings',
          sa.Column('hold_report_cards_on_arrears', sa.Boolean(), nullable=False, server_default=sa.text('false')),
          sa.UniqueConstraint('tenant_id', name='uq_finance_settings_tenant'))

    for table in NEW_TABLES:
        op.create_index(f'ix_{table}_tenant_id', table, ['tenant_id'])
        _enable_rls(table)


def _parent_student(bind):
    op.add_column('parent_student', sa.Column('tenant_id', UUID(as_uuid=True), nullable=True))
    bind.execute(sa.text("UPDATE parent_student ps SET tenant_id = s.tenant_id FROM students s WHERE s.id = ps.student_id"))
    crossed = _rows(bind, """
        SELECT ps.parent_id, ps.student_id FROM parent_student ps JOIN users u ON u.id = ps.parent_id
        WHERE u.tenant_id <> ps.tenant_id OR ps.tenant_id IS NULL
    """)
    _report("parent links removed", [(r["parent_id"], r["student_id"]) for r in crossed],
            "parent and student in different schools")
    if crossed:
        bind.execute(sa.text("""
            DELETE FROM parent_student ps USING users u
            WHERE u.id = ps.parent_id AND (u.tenant_id <> ps.tenant_id OR ps.tenant_id IS NULL)
        """))
    bind.execute(sa.text("DELETE FROM parent_student WHERE tenant_id IS NULL"))
    op.alter_column('parent_student', 'tenant_id', nullable=False)
    op.create_foreign_key('parent_student_tenant_id_fkey', 'parent_student', 'tenants', ['tenant_id'], ['id'],
                          ondelete='RESTRICT')
    op.create_foreign_key('fk_tn_parent_student_student_id', 'parent_student', 'students',
                          ['tenant_id', 'student_id'], ['tenant_id', 'id'])
    op.create_foreign_key('fk_tn_parent_student_parent_id', 'parent_student', 'users',
                          ['tenant_id', 'parent_id'], ['tenant_id', 'id'])
    op.create_index('ix_parent_student_tenant_id', 'parent_student', ['tenant_id'])
    total = bind.execute(sa.text("SELECT count(*) FROM parent_student")).scalar()
    print(f"{TAG} parent_student: tenant_id set on {total} links")


METHODS = {"CASH": "cash", "MOBILE_MONEY": "mobile_money", "MOBILE": "mobile_money", "MOMO": "mobile_money",
           "ORANGE_MONEY": "mobile_money", "LONESTAR_MOMO": "mobile_money"}


def _method(old):
    key = (old or "").strip().upper().replace(" ", "_")
    if key in METHODS:
        return METHODS[key], True
    if any(w in key for w in ("BANK", "TRANSFER", "CHEQUE", "CHECK", "CARD", "STRIPE")):
        return "bank", True
    return "cash", False


def _move_data(bind):
    now_sql = "now()"
    semesters = defaultdict(list)
    for s in _rows(bind, "SELECT id, tenant_id, academic_year_id, semester_number, name, start_date, end_date "
                         "FROM semesters ORDER BY semester_number"):
        semesters[(s["tenant_id"], s["academic_year_id"])].append(s)
    years = {y["id"]: y for y in _rows(bind, "SELECT id, tenant_id, start_date FROM academic_years")}
    categories = {c["id"]: c for c in _rows(bind, "SELECT id, name FROM fee_categories")}

    def semester_for(tenant, year, due):
        sems = semesters.get((tenant, year), [])
        for s in sems:
            if s["start_date"] <= due <= s["end_date"]:
                return s, True
        if not sems:
            return None, False
        nearest = min(sems, key=lambda s: min(abs((s["start_date"] - due).days), abs((s["end_date"] - due).days)))
        return nearest, False

    # 1. fee structures -> schedules
    schedule_of, structure_sem, taken = {}, {}, {}
    no_semester, nearest_used, merged = [], [], []
    for fs in _rows(bind, "SELECT * FROM fee_structures ORDER BY created_at"):
        sem, inside = semester_for(fs["tenant_id"], fs["academic_year_id"], fs["due_date"])
        if sem is None:
            no_semester.append(fs["id"])
            continue
        if not inside:
            nearest_used.append(fs["id"])
        structure_sem[fs["id"]] = sem
        key = (fs["tenant_id"], fs["academic_year_id"], sem["id"], fs["grade_id"], fs["category_id"])
        if key in taken:  # same year/semester/grade/category twice: lines keep their amounts, no schedule
            merged.append(fs["id"])
            schedule_of[fs["id"]] = None
            continue
        sid = uuid.uuid4()
        taken[key] = sid
        schedule_of[fs["id"]] = sid
        bind.execute(sa.text(f"""
            INSERT INTO fee_schedules (id, tenant_id, academic_year_id, semester_id, grade_id, category_id,
                                       amount_usd, amount_lrd, created_at, updated_at)
            VALUES (:id, :t, :y, :s, :g, :c, :amount, NULL, :created, {now_sql})
        """), {"id": sid, "t": fs["tenant_id"], "y": fs["academic_year_id"], "s": sem["id"], "g": fs["grade_id"],
               "c": fs["category_id"], "amount": fs["amount"], "created": fs["created_at"]})
    print(f"{TAG} fee_structures -> fee_schedules: {len(taken)} created (USD)")
    _report("fee structures without a schedule", no_semester, "their school year has no semesters; their fees are skipped")
    _report("fee structures placed in the nearest semester", nearest_used, "due date outside every semester")
    _report("fee structures merged", merged, "same year, semester, grade and category as another")

    # 2. student fees -> accounts, invoices, lines
    account_of, invoice_of, fee_invoice, invoice_owed = {}, {}, {}, defaultdict(lambda: Decimal("0"))
    sem_fees = defaultdict(list)  # (tenant, semester id) -> fee ids (for the installment plans)
    skipped_fees, line_keys = [], set()
    students = {r["id"] for r in _rows(bind, "SELECT id FROM students")}
    for f in _rows(bind, """
        SELECT sf.*, fs.academic_year_id, fs.category_id, fs.due_date AS structure_due
        FROM student_fees sf JOIN fee_structures fs ON fs.id = sf.fee_structure_id AND fs.tenant_id = sf.tenant_id
        ORDER BY sf.created_at
    """):
        sem = structure_sem.get(f["fee_structure_id"])
        if sem is None or f["student_id"] not in students:
            skipped_fees.append((f["id"], "no semester" if sem is None else "not a student"))
            continue
        t, year = f["tenant_id"], f["academic_year_id"]
        akey = (t, f["student_id"], year)
        if akey not in account_of:
            account_of[akey] = uuid.uuid4()
            bind.execute(sa.text(f"""
                INSERT INTO student_fee_accounts (id, tenant_id, student_id, academic_year_id, report_card_hold_override,
                                                  created_at, updated_at)
                VALUES (:id, :t, :s, :y, false, :created, {now_sql})
            """), {"id": account_of[akey], "t": t, "s": f["student_id"], "y": year, "created": f["created_at"]})
        ikey = (account_of[akey], sem["id"])
        if ikey not in invoice_of:
            invoice_of[ikey] = uuid.uuid4()
            bind.execute(sa.text(f"""
                INSERT INTO invoices (id, tenant_id, account_id, semester_id, status, issued_at, created_at, updated_at)
                VALUES (:id, :t, :a, :s, 'issued', :at, :at, {now_sql})
            """), {"id": invoice_of[ikey], "t": t, "a": account_of[akey], "s": sem["id"], "at": f["created_at"]})
        invoice_id = invoice_of[ikey]
        schedule_id = schedule_of.get(f["fee_structure_id"])
        if (invoice_id, schedule_id) in line_keys:
            schedule_id = None  # the same fee twice on one bill: keep the line, without the schedule link
        line_keys.add((invoice_id, schedule_id))
        cat = categories.get(f["category_id"])
        bind.execute(sa.text(f"""
            INSERT INTO invoice_lines (id, tenant_id, invoice_id, schedule_id, category_id, description,
                                       amount_usd, amount_lrd, created_at, updated_at)
            VALUES (:id, :t, :i, :sch, :c, :d, :amount, NULL, :created, {now_sql})
        """), {"id": uuid.uuid4(), "t": t, "i": invoice_id, "sch": schedule_id, "c": f["category_id"],
               "d": (cat["name"] if cat else "Fee")[:255], "amount": f["total_amount"], "created": f["created_at"]})
        fee_invoice[f["id"]] = (invoice_id, account_of[akey], year, t, Decimal(f["total_amount"]))
        invoice_owed[invoice_id] += Decimal(f["total_amount"])
        sem_fees[(t, sem["id"], year)].append((f["id"], Decimal(f["total_amount"]), f["structure_due"]))
    print(f"{TAG} student_fees -> {len(account_of)} accounts, {len(invoice_of)} invoices, "
          f"{len(fee_invoice)} lines (of {len(fee_invoice) + len(skipped_fees)} fees)")
    _report("student fees skipped", skipped_fees, "see reason")

    # 3. payments
    counters = defaultdict(int)
    allocated_to = defaultdict(lambda: Decimal("0"))
    locked, moved, unallocated, odd_methods, skipped_pay = set(), 0, [], [], []
    for p in _rows(bind, "SELECT * FROM fee_payments ORDER BY payment_date, created_at, id"):
        target = fee_invoice.get(p["student_fee_id"])
        if target is None:
            skipped_pay.append(p["id"])
            continue
        invoice_id, account_id, year, t, _amount = target
        receipt_year = years[year]["start_date"].year
        counters[(t, receipt_year)] += 1
        seq = counters[(t, receipt_year)]
        method, known = _method(p["payment_method"])
        if not known:
            odd_methods.append((p["id"], p["payment_method"]))
        pid = uuid.uuid4()
        amount = Decimal(p["amount_paid"]).quantize(CENT, rounding=ROUND_HALF_UP)
        if amount <= 0:
            skipped_pay.append(p["id"])
            counters[(t, receipt_year)] -= 1
            continue
        bind.execute(sa.text(f"""
            INSERT INTO payments (id, tenant_id, account_id, receipt_year, receipt_seq, receipt_number, amount, currency,
                                  method, reference, note, received_at, created_at, updated_at)
            VALUES (:id, :t, :a, :ry, :seq, :num, :amount, 'USD', :m, :ref, :note, :at, :created, {now_sql})
        """), {"id": pid, "t": t, "a": account_id, "ry": receipt_year, "seq": seq, "num": f"{receipt_year}-{seq:05d}",
               "amount": amount, "m": method, "ref": p["reference_id"],
               "note": "Moved from the previous fee records", "at": p["payment_date"], "created": p["created_at"]})
        moved += 1
        room = invoice_owed[invoice_id] - allocated_to[invoice_id]
        part = min(room, amount)
        if part > 0:
            allocated_to[invoice_id] += part
            bind.execute(sa.text(f"""
                INSERT INTO payment_allocations (id, tenant_id, payment_id, invoice_id, amount, created_at, updated_at)
                VALUES (:id, :t, :p, :i, :amount, :at, {now_sql})
            """), {"id": uuid.uuid4(), "t": t, "p": pid, "i": invoice_id, "amount": part, "at": p["created_at"]})
        if amount > part:
            unallocated.append((f"{receipt_year}-{seq:05d}", f"USD {amount - part:.2f}"))
        if account_id not in locked:
            locked.add(account_id)
            bind.execute(sa.text("UPDATE student_fee_accounts SET currency = 'USD', currency_locked_at = :at WHERE id = :id"),
                         {"at": p["payment_date"], "id": account_id})
    for (t, receipt_year), last in counters.items():
        bind.execute(sa.text(f"""
            INSERT INTO receipt_counters (id, tenant_id, year, last_number, created_at, updated_at)
            VALUES (:id, :t, :y, :n, {now_sql}, {now_sql})
        """), {"id": uuid.uuid4(), "t": t, "y": receipt_year, "n": last})
    print(f"{TAG} fee_payments -> payments: {moved} moved (USD), {len(locked)} accounts locked to USD, "
          f"receipt counters: {dict((f'{t}:{y}', n) for (t, y), n in counters.items())}")
    _report("payments left unallocated", unallocated, "more than their fee still owed; kept as recorded")
    _report("payments skipped", skipped_pay, "their fee was not moved or the amount is not positive")
    _report("payment methods recorded as cash", odd_methods, "unknown method")

    # 4. installment plans
    installments = defaultdict(list)
    for i in _rows(bind, "SELECT student_fee_id, amount, due_date FROM fee_installments ORDER BY due_date"):
        installments[i["student_fee_id"]].append((i["due_date"], Decimal(i["amount"])))
    agreed, fallback = 0, []
    sem_by_id = {s["id"]: s for ss in semesters.values() for s in ss}
    for (t, sem_id, year), fees in sem_fees.items():
        patterns = set()
        for fee_id, total, structure_due in fees:
            rows = installments.get(fee_id) or [(structure_due, total)]
            whole = sum((a for _, a in rows), Decimal("0"))
            if whole <= 0:
                patterns.add(None)
                continue
            merged_rows = defaultdict(lambda: Decimal("0"))
            for due, amount in rows:
                merged_rows[due] += amount
            patterns.add(tuple((due, (amount * 100 / whole).quantize(CENT, rounding=ROUND_HALF_UP))
                               for due, amount in sorted(merged_rows.items())))
        sem = sem_by_id[sem_id]
        plan = None
        if len(patterns) == 1 and None not in patterns:
            plan = list(next(iter(patterns)))
            diff = Decimal("100.00") - sum((pct for _, pct in plan), Decimal("0"))
            plan[-1] = (plan[-1][0], plan[-1][1] + diff)
            if any(pct <= 0 or pct > 100 for _, pct in plan):
                plan = None
        if plan is None:
            plan = [(sem["end_date"], Decimal("100.00"))]
            fallback.append(f"{sem['name']} ({sem_id})")
        else:
            agreed += 1
        for n, (due, pct) in enumerate(plan, start=1):
            bind.execute(sa.text(f"""
                INSERT INTO installment_plans (id, tenant_id, academic_year_id, semester_id, sequence, due_date, percent,
                                               created_at, updated_at)
                VALUES (:id, :t, :y, :s, :n, :d, :p, {now_sql}, {now_sql})
            """), {"id": uuid.uuid4(), "t": t, "y": year, "s": sem_id, "n": n, "d": due, "p": pct})
    print(f"{TAG} installment plans: {agreed} semesters from the old due dates")
    _report("semesters given one installment at the semester's end", fallback,
            "their fees' old due dates or shares disagree")


def upgrade() -> None:
    bind = op.get_bind()
    _bypass_rls(bind)

    op.add_column('fee_categories', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    _create_tables()
    _parent_student(bind)
    _move_data(bind)

    for name in GRANTED:
        bind.execute(sa.text("""
            INSERT INTO permissions (id, name, description, created_at, updated_at)
            SELECT :id, :name, :name, now(), now()
            WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = :name)
        """), {"id": uuid.uuid4(), "name": name})
    granted = bind.execute(sa.text("""
        INSERT INTO permission_role (permission_id, role_id)
        SELECT p.id, r.id FROM permissions p, user_roles r
        WHERE p.name = ANY(:names) AND r.name = 'admin' AND r.tenant_id IS NULL
        ON CONFLICT DO NOTHING
    """), {"names": list(GRANTED)}).rowcount
    print(f"{TAG} permissions granted to admin: {granted} new")

    for table in ('fee_payments', 'fee_installments', 'student_fees', 'fee_structures'):
        op.drop_table(table)
    print(f"{TAG} old tables dropped: fee_payments, fee_installments, student_fees, fee_structures")


def _old_table(name, *columns, unique_tn=False):
    op.create_table(
        name, *columns,
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False),
        *([sa.UniqueConstraint('tenant_id', 'id', name=f'uq_tn_{name}')] if unique_tn else []),
    )
    op.create_index(f'ix_{name}_tenant_id', name, ['tenant_id'])
    _enable_rls(name)


def downgrade() -> None:
    bind = op.get_bind()
    _bypass_rls(bind)

    _old_table('fee_structures',
               sa.Column('category_id', UUID(as_uuid=True), nullable=False),
               sa.Column('academic_year_id', UUID(as_uuid=True), nullable=False),
               sa.Column('amount', sa.Numeric(10, 2), nullable=False),
               sa.Column('due_date', sa.Date(), nullable=False),
               sa.Column('grade_id', UUID(as_uuid=True), nullable=True),
               unique_tn=True)
    op.create_foreign_key('fk_tn_fee_structures_academic_year_id', 'fee_structures', 'academic_years',
                          ['tenant_id', 'academic_year_id'], ['tenant_id', 'id'])
    op.create_foreign_key('fk_tn_fee_structures_category_id', 'fee_structures', 'fee_categories',
                          ['tenant_id', 'category_id'], ['tenant_id', 'id'])
    op.create_foreign_key('fk_tn_fee_structures_grade_id', 'fee_structures', 'academic_grades',
                          ['tenant_id', 'grade_id'], ['tenant_id', 'id'])
    _old_table('student_fees',
               sa.Column('fee_structure_id', UUID(as_uuid=True), nullable=False),
               sa.Column('student_id', UUID(as_uuid=True), nullable=False),
               sa.Column('total_amount', sa.Numeric(10, 2), nullable=False),
               sa.Column('amount_paid', sa.Numeric(10, 2), nullable=False),
               sa.Column('balance', sa.Numeric(10, 2), nullable=False),
               sa.Column('status', sa.String(20), nullable=False),
               unique_tn=True)
    op.create_foreign_key('fk_tn_student_fees_fee_structure_id', 'student_fees', 'fee_structures',
                          ['tenant_id', 'fee_structure_id'], ['tenant_id', 'id'])
    op.create_foreign_key('fk_tn_student_fees_student_id', 'student_fees', 'users',
                          ['tenant_id', 'student_id'], ['tenant_id', 'id'])
    _old_table('fee_installments',
               sa.Column('student_fee_id', UUID(as_uuid=True), nullable=False),
               sa.Column('amount', sa.Numeric(10, 2), nullable=False),
               sa.Column('due_date', sa.Date(), nullable=False),
               sa.Column('status', sa.String(20), nullable=False))
    op.create_foreign_key('fk_tn_fee_installments_student_fee_id', 'fee_installments', 'student_fees',
                          ['tenant_id', 'student_fee_id'], ['tenant_id', 'id'])
    _old_table('fee_payments',
               sa.Column('student_fee_id', UUID(as_uuid=True), nullable=False),
               sa.Column('amount_paid', sa.Numeric(10, 2), nullable=False),
               sa.Column('payment_method', sa.String(50), nullable=False),
               sa.Column('payment_date', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
               sa.Column('reference_id', sa.String(100), nullable=True))
    op.create_foreign_key('fk_tn_fee_payments_student_fee_id', 'fee_payments', 'student_fees',
                          ['tenant_id', 'student_fee_id'], ['tenant_id', 'id'])
    print(f"{TAG} downgrade: old fee tables recreated EMPTY (moved data is not copied back)")

    bind.execute(sa.text("""
        DELETE FROM permission_role
        WHERE permission_id IN (SELECT id FROM permissions WHERE name = ANY(:names))
          AND role_id IN (SELECT id FROM user_roles WHERE name = 'admin' AND tenant_id IS NULL)
    """), {"names": list(REVOKE_ON_DOWNGRADE)})

    op.drop_index('ix_parent_student_tenant_id', table_name='parent_student')
    op.drop_constraint('fk_tn_parent_student_parent_id', 'parent_student', type_='foreignkey')
    op.drop_constraint('fk_tn_parent_student_student_id', 'parent_student', type_='foreignkey')
    op.drop_constraint('parent_student_tenant_id_fkey', 'parent_student', type_='foreignkey')
    op.drop_column('parent_student', 'tenant_id')

    for table in NEW_TABLES:
        op.drop_table(table)
    op.drop_column('fee_categories', 'is_active')

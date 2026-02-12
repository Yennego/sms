"""
add_tenant_id_to_existing_tables

Revision ID: 89ae21af15ae
Revises: 85af8a038e9d
Create Date: 2025-07-19 13:25:58.505000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '89ae21af15ae'
down_revision = '85af8a038e9d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    tables_to_update = [
        'academic_grades',
        'academic_years',
        'announcements',
        'assignments',
        'classes',
        'enrollments',
        'events',
        'exams',
        'feedbacks',
        'grades',
        'messages',
        'schedules',
        'sections',
        'subjects',
        'timetables',
    ]

    existing_tables = set(insp.get_table_names())

    def table_exists(t: str) -> bool:
        return t in existing_tables

    def has_column(t: str, col: str) -> bool:
        if not table_exists(t):
            return False
        return any(c['name'] == col for c in insp.get_columns(t))

    def has_index(t: str, name: str) -> bool:
        if not table_exists(t):
            return False
        return any(ix['name'] == name for ix in insp.get_indexes(t))

    def has_fk_to_tenants(t: str) -> bool:
        if not table_exists(t):
            return False
        for fk in insp.get_foreign_keys(t):
            if (
                fk.get('referred_table') == 'tenants' and
                fk.get('constrained_columns') == ['tenant_id'] and
                fk.get('referred_columns') == ['id']
            ):
                return True
        return False

    def invalid_fk_rows(t: str) -> int:
        if not table_exists(t) or not has_column(t, 'tenant_id'):
            return 0
        res = bind.execute(sa.text(f'''
            SELECT COUNT(*) AS cnt
            FROM "{t}" t
            WHERE NOT EXISTS (
                SELECT 1 FROM tenants tn WHERE tn.id = t.tenant_id
            )
        '''))
        return int(res.scalar() or 0)

    for t in tables_to_update:
        if not table_exists(t):
            continue

        if not has_column(t, 'tenant_id'):
            op.add_column(t, sa.Column('tenant_id', sa.UUID(), nullable=False))

        idx_name = op.f(f'ix_{t}_tenant_id')
        if has_column(t, 'tenant_id') and not has_index(t, idx_name):
            op.create_index(idx_name, t, ['tenant_id'], unique=False)

        if has_column(t, 'tenant_id') and not has_fk_to_tenants(t):
            if invalid_fk_rows(t) == 0:
                op.create_foreign_key(
                    None, t, 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE'
                )
            else:
                constraint_name = f'{t}_tenant_id_fkey'
                op.execute(sa.text(
                    f'ALTER TABLE "{t}" ADD CONSTRAINT "{constraint_name}" '
                    f'FOREIGN KEY (tenant_id) REFERENCES tenants(id) '
                    f'ON DELETE CASCADE NOT VALID'
                ))

    if table_exists('activity_logs') and has_column('activity_logs', 'tenant_id'):
        idx_name = op.f('ix_activity_logs_tenant_id')
        if not has_index('activity_logs', idx_name):
            op.create_index(idx_name, 'activity_logs', ['tenant_id'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    tables_to_update = [
        'academic_grades',
        'academic_years',
        'announcements',
        'assignments',
        'classes',
        'enrollments',
        'events',
        'exams',
        'feedbacks',
        'grades',
        'messages',
        'schedules',
        'sections',
        'subjects',
        'timetables',
    ]

    existing_tables = set(insp.get_table_names())

    def table_exists(t: str) -> bool:
        return t in existing_tables

    def has_column(t: str, col: str) -> bool:
        if not table_exists(t):
            return False
        return any(c['name'] == col for c in insp.get_columns(t))

    def has_index(t: str, name: str) -> bool:
        if not table_exists(t):
            return False
        return any(ix['name'] == name for ix in insp.get_indexes(t))

    def fk_name_to_tenants(t: str) -> str | None:
        if not table_exists(t):
            return None
        for fk in insp.get_foreign_keys(t):
            if (
                fk.get('referred_table') == 'tenants' and
                fk.get('constrained_columns') == ['tenant_id'] and
                fk.get('referred_columns') == ['id']
            ):
                return fk.get('name')
        return None

    if table_exists('activity_logs'):
        idx_name = op.f('ix_activity_logs_tenant_id')
        if has_index('activity_logs', idx_name):
            op.drop_index(idx_name, table_name='activity_logs')

    for t in reversed(tables_to_update):
        if not table_exists(t):
            continue

        fk_name = fk_name_to_tenants(t)
        if fk_name:
            op.drop_constraint(fk_name, t, type_='foreignkey')

        idx_name = op.f(f'ix_{t}_tenant_id')
        if has_index(t, idx_name):
            op.drop_index(idx_name, table_name=t)

        if has_column(t, 'tenant_id'):
            op.drop_column(t, 'tenant_id')
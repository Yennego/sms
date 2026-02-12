"""Add unique (tenant_id, name) constraint to subjects."""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'fb2d0b7812a4'
down_revision = 'e61a8f2b9ba0'
branch_labels = None
depends_on = None

def upgrade():
    op.create_unique_constraint(
        'uq_subject_tenant_name',
        'subjects',
        ['tenant_id', 'name']
    )
    op.create_index(
        'ix_subject_tenant_active_name',
        'subjects',
        ['tenant_id', 'is_active', 'name'],
        unique=False
    )

def downgrade():
    op.drop_index('ix_subject_tenant_active_name', table_name='subjects')
    op.drop_constraint('uq_subject_tenant_name', 'subjects', type_='unique')
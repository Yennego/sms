"""
attendance_documents

Excuse documents (doctor's notes, parent letters), stored in the database
because the app has no persistent file storage.

Revision ID: f1c9d3e7a2b5
Revises: e8f4a6b1c372
Create Date: 2026-10-26 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f1c9d3e7a2b5'
down_revision = 'e8f4a6b1c372'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'attendance_documents',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('tenant_id', sa.UUID(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('daily_attendance_id', sa.UUID(),
                  sa.ForeignKey('daily_attendances.id', ondelete='CASCADE'), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=100), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('data', sa.LargeBinary(), nullable=False),
        sa.Column('uploaded_by', sa.UUID(), sa.ForeignKey('users.id'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'daily_attendance_id', name='uq_attendance_document_record'),
    )
    op.create_index('ix_attendance_documents_tenant_id', 'attendance_documents', ['tenant_id'])


def downgrade() -> None:
    op.drop_table('attendance_documents')

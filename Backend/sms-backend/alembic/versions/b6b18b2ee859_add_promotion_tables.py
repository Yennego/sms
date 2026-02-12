"""
add promotion tables

Revision ID: b6b18b2ee859
Revises: fe7ad2542795
Create Date: 2025-11-21 12:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'b6b18b2ee859'
down_revision = 'fe7ad2542795'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # promotion_criteria
    op.create_table(
        'promotion_criteria',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        sa.Column('academic_year_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('academic_years.id'), nullable=False),
        sa.Column('grade_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('academic_grades.id'), nullable=False),

        sa.Column('passing_mark', sa.Integer(), nullable=False, server_default='70'),
        sa.Column('min_passed_subjects', sa.Integer(), nullable=True),
        sa.Column('require_core_pass', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('core_subject_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('weighting_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('aggregate_method', sa.String(length=20), nullable=False, server_default='average'),
    )
    op.create_unique_constraint(
        'uq_promotion_criteria_tenant_year_grade',
        'promotion_criteria',
        ['tenant_id', 'academic_year_id', 'grade_id']
    )
    op.create_index(
        'ix_promotion_criteria_tenant_grade',
        'promotion_criteria',
        ['tenant_id', 'grade_id']
    )

    # promotion_status
    op.create_table(
        'promotion_status',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('enrollment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('enrollments.id'), nullable=False),
        sa.Column('academic_year_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('academic_years.id'), nullable=False),

        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('next_grade_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('academic_grades.id'), nullable=True),
        sa.Column('next_section_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sections.id'), nullable=True),
        sa.Column('next_class_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('classes.id'), nullable=True),

        sa.Column('failed_subject_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('total_score', sa.String(length=32), nullable=True),
        sa.Column('promotion_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
    )
    op.create_unique_constraint(
        'uq_promotion_status_tenant_enrollment',
        'promotion_status',
        ['tenant_id', 'enrollment_id']
    )
    op.create_index(
        'ix_promotion_status_tenant_student',
        'promotion_status',
        ['tenant_id', 'student_id']
    )

    # remedial_sessions
    op.create_table(
        'remedial_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('enrollment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('enrollments.id'), nullable=False),
        sa.Column('subject_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('subjects.id'), nullable=False),
        sa.Column('academic_year_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('academic_years.id'), nullable=False),

        sa.Column('scheduled_date', sa.Date(), nullable=False, server_default=sa.text('now()')),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='scheduled'),
        sa.Column('new_score', sa.Float(), nullable=True),
        sa.Column('passed', sa.Boolean(), nullable=True),
    )
    op.create_index(
        'ix_remedial_sessions_tenant_enrollment',
        'remedial_sessions',
        ['tenant_id', 'enrollment_id']
    )


def downgrade() -> None:
    op.drop_index('ix_remedial_sessions_tenant_enrollment', table_name='remedial_sessions')
    op.drop_table('remedial_sessions')

    op.drop_index('ix_promotion_status_tenant_student', table_name='promotion_status')
    op.drop_constraint('uq_promotion_status_tenant_enrollment', 'promotion_status', type_='unique')
    op.drop_table('promotion_status')

    op.drop_index('ix_promotion_criteria_tenant_grade', table_name='promotion_criteria')
    op.drop_constraint('uq_promotion_criteria_tenant_year_grade', 'promotion_criteria', type_='unique')
    op.drop_table('promotion_criteria')
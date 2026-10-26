"""
student_id_cards

QR ID cards: students.card_version / card_issued_at, and the
attendance-scanner role for gate/kiosk staff.

Revision ID: e8f4a6b1c372
Revises: d5b2c8a41e07
Create Date: 2026-10-26 12:00:00.000000

"""
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e8f4a6b1c372'
down_revision = 'd5b2c8a41e07'
branch_labels = None
depends_on = None

SCANNER_ROLE = 'attendance-scanner'


def upgrade() -> None:
    op.add_column('students', sa.Column('card_version', sa.Integer(), server_default='1', nullable=False))
    op.add_column('students', sa.Column('card_issued_at', sa.DateTime(timezone=True), nullable=True))

    bind = op.get_bind()
    exists = bind.execute(
        sa.text("SELECT 1 FROM user_roles WHERE name = :name"), {"name": SCANNER_ROLE}
    ).first()
    if not exists:
        now = datetime.now(timezone.utc)
        bind.execute(
            sa.text(
                "INSERT INTO user_roles (id, name, description, created_at, updated_at) "
                "VALUES (:id, :name, :description, :now, :now)"
            ),
            {
                "id": uuid.uuid4(),
                "name": SCANNER_ROLE,
                "description": "Gate/kiosk staff who check students in by scanning ID cards",
                "now": now,
            },
        )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "DELETE FROM user_role_association WHERE role_id IN (SELECT id FROM user_roles WHERE name = :name)"
        ),
        {"name": SCANNER_ROLE},
    )
    bind.execute(sa.text("DELETE FROM user_roles WHERE name = :name"), {"name": SCANNER_ROLE})
    op.drop_column('students', 'card_issued_at')
    op.drop_column('students', 'card_version')

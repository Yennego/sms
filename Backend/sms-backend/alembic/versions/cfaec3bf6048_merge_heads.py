"""
merge heads

Revision ID: cfaec3bf6048
Revises: b6b18b2ee859, fb2d0b7812a4
Create Date: 2025-11-21 18:05:24.187190

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'cfaec3bf6048'
down_revision = ('b6b18b2ee859', 'fb2d0b7812a4')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
"""
add_is_first_login_to_user

Revision ID: fe7ad2542795
Revises: 8e1fbf069447
Create Date: 2025-05-11 19:05:05.846679

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fe7ad2542795'
down_revision = 'a9860931f966'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_first_login column to users table
    op.add_column('users', sa.Column('is_first_login', sa.Boolean(), nullable=False, server_default='true'))

def downgrade() -> None:
    # Remove is_first_login column from users table
    op.drop_column('users', 'is_first_login')
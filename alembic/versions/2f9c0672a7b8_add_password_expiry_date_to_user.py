"""
add_password_expiry_date_to_user

Revision ID: 2f9c0672a7b8
Revises: fe7ad2542795
Create Date: 2025-05-17 15:20:14.650242

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2f9c0672a7b8'
down_revision = 'fe7ad2542795'
branch_labels = None
depends_on = None


# In the generated migration file

def upgrade():
    op.add_column('users', sa.Column('password_expiry_date', sa.DateTime(), nullable=True))

def downgrade():
    op.drop_column('users', 'password_expiry_date')
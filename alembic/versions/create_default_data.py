"""create default data

Revision ID: create_default_data
Revises: 3584c9fd5f17
Create Date: 2024-04-27 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid
from datetime import datetime
from src.core.password import get_password_hash

# revision identifiers, used by Alembic.
revision = 'create_default_data'
down_revision = '3584c9fd5f17'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create default tenant
    tenant_id = str(uuid.uuid4())
    op.execute(f"""
        INSERT INTO tenant (id, created_at, updated_at, name, slug, is_active, settings)
        VALUES (
            '{tenant_id}',
            '{datetime.utcnow()}',
            '{datetime.utcnow()}',
            'Default Tenant',
            'default',
            true,
            '{{}}'
        )
    """)

    # Create default admin user
    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash("admin123")
    op.execute(f"""
        INSERT INTO users (id, created_at, updated_at, tenant_id, email, hashed_password, full_name, is_active, is_superuser)
        VALUES (
            '{user_id}',
            '{datetime.utcnow()}',
            '{datetime.utcnow()}',
            '{tenant_id}',
            'admin@example.com',
            '{hashed_password}',
            'Admin User',
            true,
            true
        )
    """)


def downgrade() -> None:
    op.execute("DELETE FROM users WHERE email = 'admin@example.com'")
    op.execute("DELETE FROM tenant WHERE slug = 'default'") 
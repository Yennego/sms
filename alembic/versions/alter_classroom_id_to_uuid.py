"""alter classroom id to uuid

Revision ID: alter_classroom_id_to_uuid
Revises: c9895539ff4c
Create Date: 2025-04-27 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'alter_classroom_id_to_uuid'
down_revision: Union[str, None] = 'c9895539ff4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create a temporary column for UUID
    op.add_column('classroom', sa.Column('id_new', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Update the new column with UUID values
    op.execute("UPDATE classroom SET id_new = id::uuid")
    
    # Drop the old primary key constraint
    op.drop_constraint('classroom_pkey', 'classroom', type_='primary')
    
    # Drop the old column
    op.drop_column('classroom', 'id')
    
    # Rename the new column
    op.alter_column('classroom', 'id_new', new_column_name='id')
    
    # Add the primary key constraint
    op.create_primary_key('classroom_pkey', 'classroom', ['id'])


def downgrade() -> None:
    # Create a temporary column for String
    op.add_column('classroom', sa.Column('id_old', sa.String(), nullable=True))
    
    # Update the new column with String values
    op.execute("UPDATE classroom SET id_old = id::text")
    
    # Drop the old primary key constraint
    op.drop_constraint('classroom_pkey', 'classroom', type_='primary')
    
    # Drop the old column
    op.drop_column('classroom', 'id')
    
    # Rename the new column
    op.alter_column('classroom', 'id_old', new_column_name='id')
    
    # Add the primary key constraint
    op.create_primary_key('classroom_pkey', 'classroom', ['id']) 
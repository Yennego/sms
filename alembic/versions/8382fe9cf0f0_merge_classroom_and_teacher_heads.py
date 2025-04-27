"""merge classroom and teacher heads

Revision ID: 8382fe9cf0f0
Revises: create_classroom_table, create_teacher_table
Create Date: 2025-04-27 16:59:50.012945

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8382fe9cf0f0'
down_revision: Union[str, None] = ('create_classroom_table', 'create_teacher_table')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass 
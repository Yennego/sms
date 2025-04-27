"""alter classroom id to uuid

Revision ID: c9895539ff4c
Revises: 9d4dccd51741
Create Date: 2025-04-27 20:50:57.356456

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9895539ff4c'
down_revision: Union[str, None] = '9d4dccd51741'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass 
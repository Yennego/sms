"""alter classroom id to uuid

Revision ID: cc334a4d7456
Revises: 221be0755d48
Create Date: 2025-04-27 17:43:47.831129

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cc334a4d7456'
down_revision: Union[str, None] = '221be0755d48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass 
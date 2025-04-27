"""alter classroom id to uuid

Revision ID: 221be0755d48
Revises: 8382fe9cf0f0
Create Date: 2025-04-27 17:37:44.856542

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '221be0755d48'
down_revision: Union[str, None] = '8382fe9cf0f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass 
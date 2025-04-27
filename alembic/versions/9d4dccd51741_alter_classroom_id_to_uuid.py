"""alter classroom id to uuid

Revision ID: 9d4dccd51741
Revises: cc334a4d7456
Create Date: 2025-04-27 20:38:24.089921

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d4dccd51741'
down_revision: Union[str, None] = 'cc334a4d7456'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass 
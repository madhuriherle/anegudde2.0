"""merge_heads

Revision ID: ff2a20b3ec6b
Revises: 6f2a9d1c3e77, 95511ec9adbf
Create Date: 2026-05-09 13:01:24.450378

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ff2a20b3ec6b'
down_revision: Union[str, Sequence[str], None] = ('6f2a9d1c3e77', '95511ec9adbf')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

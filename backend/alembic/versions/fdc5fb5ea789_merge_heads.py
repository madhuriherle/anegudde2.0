"""merge_heads

Revision ID: fdc5fb5ea789
Revises: 4b1f2c3d9a80, 8c9b1a2d3e4f
Create Date: 2026-05-28 21:14:15.200742

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fdc5fb5ea789'
down_revision: Union[str, Sequence[str], None] = ('4b1f2c3d9a80', '8c9b1a2d3e4f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

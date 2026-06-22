"""merge_heads

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7, 8a448eec4f34
Create Date: 2026-06-22 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = ('b2c3d4e5f6a7', '8a448eec4f34')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

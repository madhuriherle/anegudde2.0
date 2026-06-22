"""merge heads

Revision ID: 8a448eec4f34
Revises: a1b2c3d4e5f6, b6e3f1a2c4d5
Create Date: 2026-06-22 15:32:44.778092

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8a448eec4f34'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f6', 'b6e3f1a2c4d5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

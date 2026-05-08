"""merge_heads_final

Revision ID: 823382e47192
Revises: c2f9a3d4b6e1, e47769d8c7c5
Create Date: 2026-05-08 20:15:40.516958

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '823382e47192'
down_revision: Union[str, Sequence[str], None] = ('c2f9a3d4b6e1', 'e47769d8c7c5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

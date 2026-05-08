"""merge_heads

Revision ID: 785f9ae89ced
Revises: 6d4b27722dca, a5b7c9d1e2f3, e19b7c3a2f10
Create Date: 2026-05-08 15:53:24.021407

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '785f9ae89ced'
down_revision: Union[str, Sequence[str], None] = ('6d4b27722dca', 'a5b7c9d1e2f3', 'e19b7c3a2f10')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

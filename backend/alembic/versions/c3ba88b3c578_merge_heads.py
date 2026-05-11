"""merge_heads

Revision ID: c3ba88b3c578
Revises: a7f1c9d2e4b8, d12661aeccff
Create Date: 2026-05-11 17:43:04.477717

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3ba88b3c578'
down_revision: Union[str, Sequence[str], None] = ('a7f1c9d2e4b8', 'd12661aeccff')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

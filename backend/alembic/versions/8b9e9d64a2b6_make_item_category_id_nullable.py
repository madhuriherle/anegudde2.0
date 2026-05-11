"""make_item_category_id_nullable

Revision ID: 8b9e9d64a2b6
Revises: c3ba88b3c578
Create Date: 2026-05-11 17:44:40.665892

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b9e9d64a2b6'
down_revision: Union[str, Sequence[str], None] = 'c3ba88b3c578'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('items', 'category_id',
               existing_type=sa.INTEGER(),
               nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('items', 'category_id',
               existing_type=sa.INTEGER(),
               nullable=False)

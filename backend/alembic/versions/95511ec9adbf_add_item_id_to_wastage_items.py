"""add_item_id_to_wastage_items

Revision ID: 95511ec9adbf
Revises: 9d1be2d7f605
Create Date: 2026-05-08 23:40:49.548265

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '95511ec9adbf'
down_revision: Union[str, Sequence[str], None] = '9d1be2d7f605'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('wastage_items', sa.Column('item_id', sa.Integer(), sa.ForeignKey('items.id'), nullable=True))
    op.alter_column('wastage_items', 'menu_item_id',
               existing_type=sa.INTEGER(),
               nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('wastage_items', 'menu_item_id',
               existing_type=sa.INTEGER(),
               nullable=False)
    op.drop_column('wastage_items', 'item_id')

"""add_default_approx_amount_to_menu_items

Revision ID: 5a8099632da1
Revises: a1b9c7d3e5f8
Create Date: 2026-06-23 11:50:22.312060

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5a8099632da1'
down_revision: Union[str, Sequence[str], None] = 'a1b9c7d3e5f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('menu_items', sa.Column('default_approx_amount', sa.Numeric(precision=12, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column('menu_items', 'default_approx_amount')

"""Add opening_price column to items

Revision ID: d4bb768c6c82
Revises: 5a8099632da1
Create Date: 2026-06-23 13:23:25.211148

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4bb768c6c82'
down_revision: Union[str, Sequence[str], None] = '5a8099632da1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('items', sa.Column('opening_price', sa.Numeric(15, 3), nullable=True))


def downgrade() -> None:
    op.drop_column('items', 'opening_price')

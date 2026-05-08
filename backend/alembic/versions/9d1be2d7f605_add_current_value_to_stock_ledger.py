"""add_current_value_to_stock_ledger

Revision ID: 9d1be2d7f605
Revises: 1550654beef6
Create Date: 2026-05-08 23:21:46.516425

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d1be2d7f605'
down_revision: Union[str, Sequence[str], None] = '1550654beef6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('stock_ledger', sa.Column('current_value', sa.Numeric(precision=15, scale=3), server_default='0', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('stock_ledger', 'current_value')

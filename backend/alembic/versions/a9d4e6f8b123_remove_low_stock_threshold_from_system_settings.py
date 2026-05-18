"""remove low stock threshold from system settings

Revision ID: a9d4e6f8b123
Revises: 4735556a0867
Create Date: 2026-05-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9d4e6f8b123'
down_revision: Union[str, Sequence[str], None] = '4735556a0867'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('system_settings', 'low_stock_threshold')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        'system_settings',
        sa.Column(
            'low_stock_threshold',
            sa.Numeric(precision=15, scale=3),
            nullable=False,
            server_default='10.0',
        ),
    )
    op.alter_column('system_settings', 'low_stock_threshold', server_default=None)

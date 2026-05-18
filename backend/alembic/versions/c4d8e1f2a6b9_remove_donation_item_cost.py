"""remove_donation_item_cost

Revision ID: c4d8e1f2a6b9
Revises: a1c5e9d2f7b4
Create Date: 2026-05-15 21:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4d8e1f2a6b9'
down_revision: Union[str, Sequence[str], None] = 'a1c5e9d2f7b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE stock_ledger
        SET unit_cost = 0,
            value_in = 0,
            value_out = 0,
            current_value = 0
        WHERE txn_type = 7
           OR ref_table = 'donation_entries'
        """
    )
    op.drop_column('donation_items', 'unit_cost_at_time')


def downgrade() -> None:
    op.add_column(
        'donation_items',
        sa.Column('unit_cost_at_time', sa.Numeric(15, 3), nullable=True),
    )

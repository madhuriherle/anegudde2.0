"""add_donation_type

Revision ID: e2a6b4c9d8f1
Revises: d9f4a21c8b70
Create Date: 2026-05-15 19:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e2a6b4c9d8f1'
down_revision: Union[str, Sequence[str], None] = 'd9f4a21c8b70'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'donation_entries',
        sa.Column('donation_type', sa.String(length=50), server_default='canteen', nullable=False),
    )
    op.create_index(op.f('ix_donation_entries_donation_type'), 'donation_entries', ['donation_type'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_donation_entries_donation_type'), table_name='donation_entries')
    op.drop_column('donation_entries', 'donation_type')

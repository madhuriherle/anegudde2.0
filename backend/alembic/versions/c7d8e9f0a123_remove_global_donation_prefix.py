"""remove global donation prefix

Revision ID: c7d8e9f0a123
Revises: b8c2d4e6f901
Create Date: 2026-05-18 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7d8e9f0a123'
down_revision: Union[str, Sequence[str], None] = 'b8c2d4e6f901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('system_settings', 'donation_prefix')


def downgrade() -> None:
    op.add_column(
        'system_settings',
        sa.Column('donation_prefix', sa.String(length=20), nullable=False, server_default='DON-'),
    )
    op.alter_column('system_settings', 'donation_prefix', server_default=None)

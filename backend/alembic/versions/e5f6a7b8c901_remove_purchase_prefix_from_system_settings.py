"""remove purchase prefix from system settings

Revision ID: e5f6a7b8c901
Revises: d4e5f6a7b890
Create Date: 2026-05-18 16:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5f6a7b8c901'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b890'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('system_settings', 'purchase_prefix')


def downgrade() -> None:
    op.add_column(
        'system_settings',
        sa.Column('purchase_prefix', sa.String(length=20), nullable=False, server_default='PUR-'),
    )
    op.alter_column('system_settings', 'purchase_prefix', server_default=None)

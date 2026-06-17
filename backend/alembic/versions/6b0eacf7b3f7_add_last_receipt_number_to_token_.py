"""add_last_receipt_number_to_token_generation

Revision ID: 6b0eacf7b3f7
Revises: 4f8b5f17fef9
Create Date: 2026-06-16 13:22:31.862473

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '6b0eacf7b3f7'
down_revision: Union[str, Sequence[str], None] = '4f8b5f17fef9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('token_generations', sa.Column('last_receipt_number', sa.Integer(), nullable=False, server_default=sa.text('0')))


def downgrade() -> None:
    op.drop_column('token_generations', 'last_receipt_number')

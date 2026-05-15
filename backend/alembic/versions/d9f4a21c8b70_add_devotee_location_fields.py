"""add_devotee_location_fields

Revision ID: d9f4a21c8b70
Revises: bfc392bee23a
Create Date: 2026-05-15 19:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd9f4a21c8b70'
down_revision: Union[str, Sequence[str], None] = 'bfc392bee23a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('devotees', sa.Column('city', sa.String(length=100), nullable=True))
    op.add_column('devotees', sa.Column('state', sa.String(length=100), nullable=True))
    op.add_column('devotees', sa.Column('pincode', sa.String(length=20), nullable=True))
    op.add_column('donation_entries', sa.Column('city', sa.String(length=100), nullable=True))
    op.add_column('donation_entries', sa.Column('state', sa.String(length=100), nullable=True))
    op.add_column('donation_entries', sa.Column('pincode', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('donation_entries', 'pincode')
    op.drop_column('donation_entries', 'state')
    op.drop_column('donation_entries', 'city')
    op.drop_column('devotees', 'pincode')
    op.drop_column('devotees', 'state')
    op.drop_column('devotees', 'city')

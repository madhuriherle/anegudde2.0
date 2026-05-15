"""convert_donation_type_to_integer

Revision ID: f7b8c2d9e4a1
Revises: e2a6b4c9d8f1
Create Date: 2026-05-15 19:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f7b8c2d9e4a1'
down_revision: Union[str, Sequence[str], None] = 'e2a6b4c9d8f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE donation_entries SET donation_type = '1' WHERE donation_type = 'canteen'")
    op.alter_column('donation_entries', 'donation_type', server_default=None)
    op.alter_column(
        'donation_entries',
        'donation_type',
        existing_type=sa.String(length=50),
        type_=sa.Integer(),
        existing_nullable=False,
        postgresql_using="donation_type::integer",
    )
    op.alter_column('donation_entries', 'donation_type', server_default='1')


def downgrade() -> None:
    op.alter_column('donation_entries', 'donation_type', server_default=None)
    op.alter_column(
        'donation_entries',
        'donation_type',
        existing_type=sa.Integer(),
        type_=sa.String(length=50),
        existing_nullable=False,
        postgresql_using="donation_type::text",
    )
    op.execute("UPDATE donation_entries SET donation_type = 'canteen' WHERE donation_type = '1'")
    op.alter_column('donation_entries', 'donation_type', server_default='canteen')

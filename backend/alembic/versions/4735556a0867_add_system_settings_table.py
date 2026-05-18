"""add system settings table

Revision ID: 4735556a0867
Revises: c4d8e1f2a6b9
Create Date: 2026-05-18 11:28:44.614756

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '4735556a0867'
down_revision: Union[str, Sequence[str], None] = 'c4d8e1f2a6b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('system_settings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('temple_name', sa.String(length=255), nullable=False),
    sa.Column('temple_address', sa.Text(), nullable=True),
    sa.Column('temple_contact', sa.String(length=100), nullable=True),
    sa.Column('donation_prefix', sa.String(length=20), nullable=False),
    sa.Column('token_prefix', sa.String(length=20), nullable=False),
    sa.Column('purchase_prefix', sa.String(length=20), nullable=False),
    sa.Column('receipt_padding', sa.Integer(), nullable=False),
    sa.Column('current_financial_year_id', sa.Integer(), nullable=True),
    sa.Column('low_stock_threshold', sa.Numeric(precision=15, scale=3), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_by', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['current_financial_year_id'], ['financial_years.id'], ),
    sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('system_settings')

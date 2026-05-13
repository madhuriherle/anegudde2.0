"""add purchase return system

Revision ID: 60deefdc3e82
Revises: 8b9e9d64a2b6
Create Date: 2026-05-13 20:44:45.076160

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '60deefdc3e82'
down_revision: Union[str, Sequence[str], None] = '8b9e9d64a2b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'purchase_return_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('return_date', sa.Date(), nullable=False),
        sa.Column('vendor_id', sa.Integer(), sa.ForeignKey('vendors.id'), nullable=False),
        sa.Column('purchase_entry_id', sa.Integer(), sa.ForeignKey('purchase_entries.id'), nullable=True),
        sa.Column('total_return_amount', sa.Numeric(15, 3), nullable=False),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('status', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'purchase_return_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('return_entry_id', sa.Integer(), sa.ForeignKey('purchase_return_entries.id'), nullable=False),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('items.id'), nullable=False),
        sa.Column('quantity', sa.Numeric(15, 3), nullable=False),
        sa.Column('price', sa.Numeric(15, 3), nullable=False),
        sa.Column('line_total', sa.Numeric(15, 3), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('purchase_return_items')
    op.drop_table('purchase_return_entries')

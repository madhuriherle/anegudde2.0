"""add_devotee_system

Revision ID: bfc392bee23a
Revises: 3658d24ecdc7
Create Date: 2026-05-15 17:35:56.433868

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bfc392bee23a'
down_revision: Union[str, Sequence[str], None] = '3658d24ecdc7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create devotees table
    op.create_table('devotees',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('devotee_name', sa.String(length=150), nullable=False),
    sa.Column('phone_number', sa.String(length=20), nullable=False),
    sa.Column('email', sa.String(length=150), nullable=True),
    sa.Column('address', sa.Text(), nullable=True),
    sa.Column('status', sa.Integer(), nullable=False, server_default=sa.text('1')),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('created_by', sa.Integer(), nullable=True),
    sa.Column('updated_by', sa.Integer(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_devotees_phone_number'), 'devotees', ['phone_number'], unique=True)
    op.create_index(op.f('ix_devotees_status'), 'devotees', ['status'], unique=False)

    # 2. Add devotee_id to donation_entries
    op.add_column('donation_entries', sa.Column('devotee_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_donation_entries_devotee_id'), 'donation_entries', ['devotee_id'], unique=False)
    op.create_foreign_key(op.f('donation_entries_devotee_id_fkey'), 'donation_entries', 'devotees', ['devotee_id'], ['id'])

    # 3. Optional: Add missing indexes for purchase returns (detected by autogenerate)
    op.create_index(op.f('ix_purchase_return_entries_purchase_entry_id'), 'purchase_return_entries', ['purchase_entry_id'], unique=False)
    op.create_index(op.f('ix_purchase_return_entries_return_date'), 'purchase_return_entries', ['return_date'], unique=False)
    op.create_index(op.f('ix_purchase_return_entries_status'), 'purchase_return_entries', ['status'], unique=False)
    op.create_index(op.f('ix_purchase_return_entries_user_id'), 'purchase_return_entries', ['user_id'], unique=False)
    op.create_index(op.f('ix_purchase_return_entries_vendor_id'), 'purchase_return_entries', ['vendor_id'], unique=False)
    op.create_index(op.f('ix_purchase_return_items_item_id'), 'purchase_return_items', ['item_id'], unique=False)
    op.create_index(op.f('ix_purchase_return_items_return_entry_id'), 'purchase_return_items', ['return_entry_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_purchase_return_items_return_entry_id'), table_name='purchase_return_items')
    op.drop_index(op.f('ix_purchase_return_items_item_id'), table_name='purchase_return_items')
    op.drop_index(op.f('ix_purchase_return_entries_vendor_id'), table_name='purchase_return_entries')
    op.drop_index(op.f('ix_purchase_return_entries_user_id'), table_name='purchase_return_entries')
    op.drop_index(op.f('ix_purchase_return_entries_status'), table_name='purchase_return_entries')
    op.drop_index(op.f('ix_purchase_return_entries_return_date'), table_name='purchase_return_entries')
    op.drop_index(op.f('ix_purchase_return_entries_purchase_entry_id'), table_name='purchase_return_entries')
    
    op.drop_constraint(op.f('donation_entries_devotee_id_fkey'), 'donation_entries', type_='foreignkey')
    op.drop_index(op.f('ix_donation_entries_devotee_id'), table_name='donation_entries')
    op.drop_column('donation_entries', 'devotee_id')
    
    op.drop_index(op.f('ix_devotees_status'), table_name='devotees')
    op.drop_index(op.f('ix_devotees_phone_number'), table_name='devotees')
    op.drop_table('devotees')

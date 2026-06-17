"""add_item_donation_flag_and_numeric_mode

Revision ID: 6665f6c74c59
Revises: 2b6d8f1a4c90
Create Date: 2026-06-16 08:41:29.268962

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6665f6c74c59'
down_revision: Union[str, Sequence[str], None] = '2b6d8f1a4c90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add is_item_donation to donation_types
    op.add_column('donation_types', sa.Column('is_item_donation', sa.Boolean(), server_default='false', nullable=False))
    
    # 2. Add donation_mode_int to donation_entries
    op.add_column('donation_entries', sa.Column('donation_mode_int', sa.Integer(), server_default='0', nullable=False))
    
    # 3. Migrate data
    op.execute("UPDATE donation_entries SET donation_mode_int = 1 WHERE donation_mode = 'AMOUNT'")
    op.execute("UPDATE donation_entries SET donation_mode_int = 0 WHERE donation_mode = 'ITEM'")
    
    # 4. Remove old column and rename new one
    op.drop_index('ix_donation_entries_donation_mode', table_name='donation_entries')
    op.drop_column('donation_entries', 'donation_mode')
    op.alter_column('donation_entries', 'donation_mode_int', new_column_name='donation_mode')
    
    # 5. Create index on the new donation_mode
    op.create_index(op.f('ix_donation_entries_donation_mode'), 'donation_entries', ['donation_mode'], unique=False)


def downgrade() -> None:
    # 1. Reverse rename and add old column
    op.drop_index(op.f('ix_donation_entries_donation_mode'), table_name='donation_entries')
    op.alter_column('donation_entries', 'donation_mode', new_column_name='donation_mode_int')
    op.add_column('donation_entries', sa.Column('donation_mode', sa.String(length=20), server_default='ITEM', nullable=False))
    
    # 2. Migrate data back
    op.execute("UPDATE donation_entries SET donation_mode = 'AMOUNT' WHERE donation_mode_int = 1")
    op.execute("UPDATE donation_entries SET donation_mode = 'ITEM' WHERE donation_mode_int = 0")
    
    # 3. Clean up
    op.drop_column('donation_entries', 'donation_mode_int')
    op.create_index('ix_donation_entries_donation_mode', 'donation_entries', ['donation_mode'], unique=False)
    
    # 4. Remove is_item_donation from donation_types
    op.drop_column('donation_types', 'is_item_donation')

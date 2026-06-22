"""add_soft_delete_columns

Revision ID: 8c1489aa0f97
Revises: 9f2a145edc74
Create Date: 2026-06-18 22:25:21.470627

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '8c1489aa0f97'
down_revision: Union[str, Sequence[str], None] = '9f2a145edc74'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Upgrade schema."""
    tables = [
        "items", "menu_items", "vendors", "item_categories", "donation_types", 
        "donation_amount_masters", "roles", "users", "units",
        "purchase_entries", "consumption_entries", "wastage_entries", 
        "donation_entries", "purchase_return_entries"
    ]
    
    for table in tables:
        # Add columns
        op.add_column(table, sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')))
        op.add_column(table, sa.Column('deleted_at', sa.DateTime(), nullable=True))
        op.add_column(table, sa.Column('deleted_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
        
        # Add index
        op.create_index(op.f(f'ix_{table}_is_deleted'), table, ['is_deleted'], unique=False)

def downgrade() -> None:
    """Downgrade schema."""
    tables = [
        "items", "menu_items", "vendors", "item_categories", "donation_types", 
        "donation_amount_masters", "roles", "users", "units",
        "purchase_entries", "consumption_entries", "wastage_entries", 
        "donation_entries", "purchase_return_entries"
    ]
    
    for table in tables:
        # Drop index
        op.drop_index(op.f(f'ix_{table}_is_deleted'), table_name=table)
        
        # Drop columns
        op.drop_column(table, 'deleted_by_id')
        op.drop_column(table, 'deleted_at')
        op.drop_column(table, 'is_deleted')

"""add donation type modules link table manually

Revision ID: 051bdebdd35e
Revises: 6665f6c74c59
Create Date: 2026-06-16 11:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '051bdebdd35e'
down_revision: Union[str, Sequence[str], None] = '6665f6c74c59'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if table already exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    
    if 'donation_type_modules' not in tables:
        # Create the link table
        op.create_table(
            'donation_type_modules',
            sa.Column('donation_type_id', sa.Integer(), nullable=False),
            sa.Column('module_id', sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(['donation_type_id'], ['donation_types.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['module_id'], ['modules.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('donation_type_id', 'module_id')
        )


def downgrade() -> None:
    op.drop_table('donation_type_modules')

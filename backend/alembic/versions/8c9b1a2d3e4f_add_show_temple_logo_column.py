"""add_show_temple_logo_column

Revision ID: 8c9b1a2d3e4f
Revises: ff2a20b3ec6b
Create Date: 2026-05-28 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8c9b1a2d3e4f'
down_revision = 'ff2a20b3ec6b' # Setting to the last known merge head
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if column exists before adding to avoid errors if it was added manually
    conn = op.get_bind()
    has_column = conn.execute(sa.text("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_settings' AND column_name='show_temple_logo')")).scalar()
    
    if not has_column:
        op.add_column('system_settings', sa.Column('show_temple_logo', sa.Boolean(), server_default=sa.text('true'), nullable=False))


def downgrade() -> None:
    op.drop_column('system_settings', 'show_temple_logo')

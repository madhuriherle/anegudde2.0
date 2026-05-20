"""add_system_settings_display_toggles

Revision ID: f198286615fd
Revises: b5283fa705a2
Create Date: 2026-05-20 10:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f198286615fd'
down_revision: Union[str, Sequence[str], None] = 'b5283fa705a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('system_settings', sa.Column('show_temple_name', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.add_column('system_settings', sa.Column('show_temple_name_kn', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.add_column('system_settings', sa.Column('show_temple_address', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.add_column('system_settings', sa.Column('show_temple_contact', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.add_column('system_settings', sa.Column('show_alternate_contact', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.add_column('system_settings', sa.Column('show_temple_email', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.add_column('system_settings', sa.Column('show_temple_website', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.add_column('system_settings', sa.Column('show_temple_timings', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.add_column('system_settings', sa.Column('show_google_maps_link', sa.Boolean(), server_default=sa.text('true'), nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('system_settings', 'show_google_maps_link')
    op.drop_column('system_settings', 'show_temple_timings')
    op.drop_column('system_settings', 'show_temple_website')
    op.drop_column('system_settings', 'show_temple_email')
    op.drop_column('system_settings', 'show_alternate_contact')
    op.drop_column('system_settings', 'show_temple_contact')
    op.drop_column('system_settings', 'show_temple_address')
    op.drop_column('system_settings', 'show_temple_name_kn')
    op.drop_column('system_settings', 'show_temple_name')

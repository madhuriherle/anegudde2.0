"""expand_temple_identity_settings_v2

Revision ID: b5283fa705a2
Revises: 562a42998ae9
Create Date: 2026-05-20 10:47:00.259532

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b5283fa705a2'
down_revision: Union[str, Sequence[str], None] = '562a42998ae9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('system_settings', sa.Column('temple_name_kn', sa.String(length=255), nullable=True))
    op.add_column('system_settings', sa.Column('alternate_contact', sa.String(length=100), nullable=True))
    op.add_column('system_settings', sa.Column('opening_time', sa.String(length=50), nullable=True))
    op.add_column('system_settings', sa.Column('closing_time', sa.String(length=50), nullable=True))
    op.add_column('system_settings', sa.Column('google_maps_link', sa.String(length=500), nullable=True))
    op.alter_column('system_settings', 'temple_name',
               existing_type=sa.VARCHAR(length=255),
               nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('system_settings', 'temple_name',
               existing_type=sa.VARCHAR(length=255),
               nullable=False)
    op.drop_column('system_settings', 'google_maps_link')
    op.drop_column('system_settings', 'closing_time')
    op.drop_column('system_settings', 'opening_time')
    op.drop_column('system_settings', 'alternate_contact')
    op.drop_column('system_settings', 'temple_name_kn')

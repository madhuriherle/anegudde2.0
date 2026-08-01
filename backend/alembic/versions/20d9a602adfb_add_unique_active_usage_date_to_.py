"""add_unique_active_usage_date_to_consumption_entries

Revision ID: 20d9a602adfb
Revises: 7379320b5076
Create Date: 2026-08-01 22:31:37.668535

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20d9a602adfb'
down_revision: Union[str, Sequence[str], None] = '7379320b5076'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Partial unique index: only one non-deleted consumption entry per
    # usage_date. The app already checks this (select-then-insert), but
    # without a DB constraint two near-simultaneous submissions could both
    # pass that check and silently create duplicate entries for the same
    # day. Scoped to is_deleted = false so soft-deleted rows don't block a
    # new entry from being created for that date.
    op.create_index(
        'ix_consumption_entries_usage_date_active_unique',
        'consumption_entries',
        ['usage_date'],
        unique=True,
        postgresql_where=sa.text('is_deleted = false'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_consumption_entries_usage_date_active_unique', table_name='consumption_entries')

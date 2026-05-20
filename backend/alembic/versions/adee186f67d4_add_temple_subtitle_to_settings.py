"""add_temple_subtitle_to_settings

Revision ID: adee186f67d4
Revises: 6e1f1708c058
Create Date: 2026-05-19 15:14:33.077860

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'adee186f67d4'
down_revision: Union[str, Sequence[str], None] = '6e1f1708c058'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('system_settings', sa.Column('temple_subtitle', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('system_settings', 'temple_subtitle')

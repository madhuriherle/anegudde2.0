"""expand_temple_identity_settings

Revision ID: 562a42998ae9
Revises: adee186f67d4
Create Date: 2026-05-19 15:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '562a42998ae9'
down_revision: Union[str, Sequence[str], None] = 'adee186f67d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('system_settings', sa.Column('temple_email', sa.String(length=150), nullable=True))
    op.add_column('system_settings', sa.Column('temple_website', sa.String(length=255), nullable=True))
    op.add_column('system_settings', sa.Column('temple_logo', sa.String(length=500), nullable=True))
    op.add_column('system_settings', sa.Column('footer_note', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('system_settings', 'footer_note')
    op.drop_column('system_settings', 'temple_logo')
    op.drop_column('system_settings', 'temple_website')
    op.drop_column('system_settings', 'temple_email')

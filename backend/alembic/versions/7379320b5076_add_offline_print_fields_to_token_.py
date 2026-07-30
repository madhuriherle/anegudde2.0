"""add_offline_print_fields_to_token_details

Revision ID: 7379320b5076
Revises: c1d2e3f4a5b6
Create Date: 2026-07-30 12:46:45.186397

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7379320b5076'
down_revision: Union[str, Sequence[str], None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('token_details', sa.Column('printed_offline', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('token_details', sa.Column('offline_local_receipt_no', sa.String(length=50), nullable=True))
    op.add_column('token_details', sa.Column('offline_printed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('token_details', 'offline_printed_at')
    op.drop_column('token_details', 'offline_local_receipt_no')
    op.drop_column('token_details', 'printed_offline')

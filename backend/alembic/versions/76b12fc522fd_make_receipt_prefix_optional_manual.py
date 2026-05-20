"""make receipt_prefix optional manual

Revision ID: 76b12fc522fd
Revises: f6a7b8c9d012
Create Date: 2026-05-18 21:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '76b12fc522fd'
down_revision: Union[str, Sequence[str], None] = 'f6a7b8c9d012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make receipt_prefix nullable in donation_types
    op.alter_column('donation_types', 'receipt_prefix',
               existing_type=sa.VARCHAR(length=20),
               nullable=True)


def downgrade() -> None:
    # Make receipt_prefix NOT nullable in donation_types
    # Note: This might fail if there are null values in the column
    op.alter_column('donation_types', 'receipt_prefix',
               existing_type=sa.VARCHAR(length=20),
               nullable=False)

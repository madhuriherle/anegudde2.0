"""add bill file fields to purchase entries

Revision ID: e19b7c3a2f10
Revises: d12f8c4a9b21
Create Date: 2026-05-08 00:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e19b7c3a2f10"
down_revision: Union[str, None] = "d12f8c4a9b21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("purchase_entries", sa.Column("bill_file_name", sa.String(length=255), nullable=True))
    op.add_column("purchase_entries", sa.Column("bill_file_path", sa.String(length=500), nullable=True))
    op.add_column("purchase_entries", sa.Column("bill_file_mime", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("purchase_entries", "bill_file_mime")
    op.drop_column("purchase_entries", "bill_file_path")
    op.drop_column("purchase_entries", "bill_file_name")

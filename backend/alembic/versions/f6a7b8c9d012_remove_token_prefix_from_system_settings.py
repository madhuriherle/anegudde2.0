"""remove token prefix from system settings

Revision ID: f6a7b8c9d012
Revises: e5f6a7b8c901
Create Date: 2026-05-18 16:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6a7b8c9d012"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("system_settings", "token_prefix")


def downgrade() -> None:
    op.add_column(
        "system_settings",
        sa.Column("token_prefix", sa.String(length=20), nullable=False, server_default="TOK-"),
    )

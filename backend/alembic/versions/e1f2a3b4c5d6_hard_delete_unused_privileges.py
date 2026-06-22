"""hard_delete_unused_privileges

Revision ID: e1f2a3b4c5d6
Revises: d4e5f6a7b8c9
Create Date: 2026-06-18 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DELETED_PRIVILEGES = [
    "tokens.delete",
    "wastages.read",
    "reports.consumptions.read",
    "reports.wastages.read",
]


def upgrade() -> None:
    conn = op.get_bind()

    for priv_name in DELETED_PRIVILEGES:
        priv_id = conn.execute(
            sa.text("SELECT id FROM privileges WHERE privilege_name = :name"),
            {"name": priv_name},
        ).scalar()

        if priv_id:
            conn.execute(
                sa.text("DELETE FROM role_privileges WHERE privilege_id = :id"),
                {"id": priv_id},
            )
            conn.execute(
                sa.text("DELETE FROM privileges WHERE id = :id"),
                {"id": priv_id},
            )


def downgrade() -> None:
    pass

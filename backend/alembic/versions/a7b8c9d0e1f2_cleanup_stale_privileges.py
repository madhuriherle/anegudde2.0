"""cleanup_stale_privileges

Revision ID: a7b8c9d0e1f2
Revises: 9c1d2e3f4a56
Create Date: 2026-06-17 11:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "9c1d2e3f4a56"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(
        sa.text(
            """
            UPDATE privileges p
            SET status = 0,
                updated_at = now()
            FROM modules m
            WHERE p.module_id = m.id
              AND p.status = 1
              AND m.status = 0
            """
        )
    )

    conn.execute(
        sa.text(
            """
            UPDATE privileges
            SET status = 0,
                updated_at = now()
            WHERE status = 1
              AND module_id IS NULL
            """
        )
    )


def downgrade() -> None:
    pass

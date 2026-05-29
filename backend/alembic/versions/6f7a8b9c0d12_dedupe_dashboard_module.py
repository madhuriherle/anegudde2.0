"""dedupe_dashboard_module

Revision ID: 6f7a8b9c0d12
Revises: 5e6f7a8b9c01
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6f7a8b9c0d12"
down_revision: Union[str, Sequence[str], None] = "5e6f7a8b9c01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    dashboard_ids = [
        row[0]
        for row in conn.execute(
            sa.text(
                """
                SELECT id
                FROM modules
                WHERE name = 'Dashboard'
                  AND route = '/canteen'
                  AND status = 1
                ORDER BY id
                """
            )
        ).fetchall()
    ]

    if len(dashboard_ids) <= 1:
        return

    keep_id = dashboard_ids[0]
    duplicate_ids = dashboard_ids[1:]

    conn.execute(
        sa.text(
            """
            UPDATE privileges
            SET module_id = :keep_id,
                updated_at = now()
            WHERE module_id = ANY(:duplicate_ids)
               OR privilege_name LIKE 'dashboard.%'
            """
        ),
        {"keep_id": keep_id, "duplicate_ids": duplicate_ids},
    )
    conn.execute(
        sa.text(
            """
            UPDATE modules
            SET status = 0,
                updated_at = now()
            WHERE id = ANY(:duplicate_ids)
            """
        ),
        {"duplicate_ids": duplicate_ids},
    )


def downgrade() -> None:
    pass

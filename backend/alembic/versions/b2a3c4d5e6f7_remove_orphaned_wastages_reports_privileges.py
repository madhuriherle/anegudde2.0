"""remove_orphaned_wastages_reports_privileges

Revision ID: b2a3c4d5e6f7
Revises: c9d8e7f6a5b4
Create Date: 2026-06-18 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2a3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "c9d8e7f6a5b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Disable wastages module (merged into daily_usage)
    conn.execute(
        sa.text(
            """
            UPDATE modules
            SET status = 0,
                updated_at = now()
            WHERE name = 'Wastages'
              AND status = 1
            """
        )
    )

    # Disable wastages.* privileges
    conn.execute(
        sa.text(
            """
            UPDATE privileges
            SET status = 0,
                updated_at = now()
            WHERE privilege_name LIKE 'wastages.%'
              AND status = 1
            """
        )
    )

    # Disable reports.consumptions.* privileges (no UI)
    conn.execute(
        sa.text(
            """
            UPDATE privileges
            SET status = 0,
                updated_at = now()
            WHERE privilege_name LIKE 'reports.consumptions.%'
              AND status = 1
            """
        )
    )

    # Disable reports.wastages.* privileges (no UI)
    conn.execute(
        sa.text(
            """
            UPDATE privileges
            SET status = 0,
                updated_at = now()
            WHERE privilege_name LIKE 'reports.wastages.%'
              AND status = 1
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()

    conn.execute(
        sa.text(
            """
            UPDATE modules
            SET status = 1,
                updated_at = now()
            WHERE name = 'Wastages'
              AND status = 0
            """
        )
    )

    for prefix in ['wastages.', 'reports.consumptions.', 'reports.wastages.']:
        conn.execute(
            sa.text(
                """
                UPDATE privileges
                SET status = 1,
                    updated_at = now()
                WHERE privilege_name LIKE :prefix
                  AND status = 0
                """
            ),
            {"prefix": f"{prefix}%"},
        )

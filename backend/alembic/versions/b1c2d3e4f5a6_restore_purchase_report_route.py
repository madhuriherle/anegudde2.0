"""restore_purchase_report_route

Revision ID: b1c2d3e4f5a6
Revises: a7b8c9d0e1f2
Create Date: 2026-06-17 14:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    canteen_id = conn.execute(
        sa.text("SELECT id FROM modules WHERE name = 'Canteen Module' AND status = 1 ORDER BY id LIMIT 1")
    ).scalar()

    if not canteen_id:
        return

    reports_id = conn.execute(
        sa.text(
            """
            SELECT id
            FROM modules
            WHERE name = 'Reports'
              AND parent_id = :canteen_id
            ORDER BY id
            LIMIT 1
            """
        ),
        {"canteen_id": canteen_id},
    ).scalar()

    if not reports_id:
        return

    conn.execute(
        sa.text(
            """
            UPDATE modules
            SET route = '/reports/purchases',
                status = 1,
                updated_at = now()
            WHERE name = 'Purchase Report'
              AND parent_id = :reports_id
            """
        ),
        {"reports_id": reports_id},
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE modules
            SET route = NULL,
                updated_at = now()
            WHERE name = 'Purchase Report'
              AND route = '/reports/purchases'
            """
        )
    )

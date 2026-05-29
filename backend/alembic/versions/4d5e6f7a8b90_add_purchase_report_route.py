"""add_purchase_report_route

Revision ID: 4d5e6f7a8b90
Revises: 3c4d5e6f7a80
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4d5e6f7a8b90"
down_revision: Union[str, Sequence[str], None] = "3c4d5e6f7a80"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    reports_parent_id = conn.execute(
        sa.text("SELECT id FROM modules WHERE name = 'Reports' LIMIT 1")
    ).scalar()

    if reports_parent_id:
        conn.execute(
            sa.text(
                """
                UPDATE modules
                SET route = '/reports/purchases',
                    status = 1,
                    updated_at = now()
                WHERE name = 'Purchase Report'
                  AND parent_id = :parent_id
                """
            ),
            {"parent_id": reports_parent_id},
        )


def downgrade() -> None:
    conn = op.get_bind()
    reports_parent_id = conn.execute(
        sa.text("SELECT id FROM modules WHERE name = 'Reports' LIMIT 1")
    ).scalar()

    if reports_parent_id:
        conn.execute(
            sa.text(
                """
                UPDATE modules
                SET route = NULL,
                    updated_at = now()
                WHERE name = 'Purchase Report'
                  AND parent_id = :parent_id
                """
            ),
            {"parent_id": reports_parent_id},
        )

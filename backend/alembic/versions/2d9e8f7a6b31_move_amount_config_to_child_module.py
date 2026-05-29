"""move_amount_config_to_child_module

Revision ID: 2d9e8f7a6b31
Revises: 7a6c5b4d3e21
Create Date: 2026-05-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2d9e8f7a6b31"
down_revision: Union[str, Sequence[str], None] = "7a6c5b4d3e21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    donations_module_id = conn.execute(
        sa.text(
            """
            SELECT id
            FROM modules
            WHERE name = 'Donations' OR route = '/donations'
            ORDER BY CASE WHEN route = '/donations' THEN 0 ELSE 1 END
            LIMIT 1
            """
        )
    ).scalar()

    if not donations_module_id:
        return

    amount_config_module_id = conn.execute(
        sa.text(
            """
            SELECT id
            FROM modules
            WHERE parent_id = :parent_id
              AND name = 'Donation Amount Configuration'
            LIMIT 1
            """
        ),
        {"parent_id": donations_module_id},
    ).scalar()

    if not amount_config_module_id:
        amount_config_module_id = conn.execute(
            sa.text(
                """
                INSERT INTO modules
                    (name, icon, parent_id, route, display_order, status, created_at, updated_at, created_by, updated_by)
                VALUES
                    ('Donation Amount Configuration', 'Settings', :parent_id, NULL, 5, 1, now(), now(), 1, 1)
                RETURNING id
                """
            ),
            {"parent_id": donations_module_id},
        ).scalar()
    else:
        conn.execute(
            sa.text(
                """
                UPDATE modules
                SET icon = COALESCE(icon, 'Settings'),
                    route = NULL,
                    status = 1,
                    updated_at = now()
                WHERE id = :module_id
                """
            ),
            {"module_id": amount_config_module_id},
        )

    conn.execute(
        sa.text(
            """
            UPDATE privileges
            SET module_id = :module_id,
                status = 1,
                updated_at = now()
            WHERE privilege_name IN (
                'donations.amount_config.read',
                'donations.amount_config.write',
                'donations.amount_config.delete'
            )
            """
        ),
        {"module_id": amount_config_module_id},
    )


def downgrade() -> None:
    conn = op.get_bind()
    donations_module_id = conn.execute(
        sa.text(
            """
            SELECT id
            FROM modules
            WHERE name = 'Donations' OR route = '/donations'
            ORDER BY CASE WHEN route = '/donations' THEN 0 ELSE 1 END
            LIMIT 1
            """
        )
    ).scalar()

    if donations_module_id:
        conn.execute(
            sa.text(
                """
                UPDATE privileges
                SET module_id = :module_id,
                    updated_at = now()
                WHERE privilege_name IN (
                    'donations.amount_config.read',
                    'donations.amount_config.write',
                    'donations.amount_config.delete'
                )
                """
            ),
            {"module_id": donations_module_id},
        )

        conn.execute(
            sa.text(
                """
                DELETE FROM modules
                WHERE parent_id = :parent_id
                  AND name = 'Donation Amount Configuration'
                """
            ),
            {"parent_id": donations_module_id},
        )

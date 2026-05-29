"""add_donation_amount_config_privileges

Revision ID: 7a6c5b4d3e21
Revises: fdc5fb5ea789
Create Date: 2026-05-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7a6c5b4d3e21"
down_revision: Union[str, Sequence[str], None] = "fdc5fb5ea789"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PRIVILEGES = (
    ("donations.amount_config.read", "Permission for donations amount configuration read"),
    ("donations.amount_config.write", "Permission for donations amount configuration write"),
    ("donations.amount_config.delete", "Permission for donations amount configuration delete"),
)


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

    if donations_module_id:
        conn.execute(
            sa.text(
                """
                UPDATE privileges
                SET module_id = :module_id
                WHERE privilege_name IN ('donations.read', 'donations.write', 'donations.delete')
                """
            ),
            {"module_id": donations_module_id},
        )

    amount_config_module_id = None
    if donations_module_id:
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

    for privilege_name, description in PRIVILEGES:
        exists = conn.execute(
            sa.text("SELECT id FROM privileges WHERE privilege_name = :privilege_name"),
            {"privilege_name": privilege_name},
        ).scalar()
        if exists:
            conn.execute(
                sa.text(
                    """
                    UPDATE privileges
                    SET description = :description,
                        status = 1,
                        module_id = COALESCE(:module_id, module_id),
                        updated_at = now()
                    WHERE privilege_name = :privilege_name
                    """
                ),
                {
                    "privilege_name": privilege_name,
                    "description": description,
                    "module_id": amount_config_module_id or donations_module_id,
                },
            )
        else:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO privileges
                        (privilege_name, description, status, created_at, updated_at, created_by, updated_by, module_id)
                    VALUES
                        (:privilege_name, :description, 1, now(), now(), 1, 1, :module_id)
                    """
                ),
                {
                    "privilege_name": privilege_name,
                    "description": description,
                    "module_id": amount_config_module_id or donations_module_id,
                },
            )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            DELETE FROM role_privileges
            WHERE privilege_id IN (
                SELECT id FROM privileges
                WHERE privilege_name IN (
                    'donations.amount_config.read',
                    'donations.amount_config.write',
                    'donations.amount_config.delete'
                )
            )
            """
        )
    )
    conn.execute(
        sa.text(
            """
            DELETE FROM privileges
            WHERE privilege_name IN (
                'donations.amount_config.read',
                'donations.amount_config.write',
                'donations.amount_config.delete'
            )
            """
        )
    )
    conn.execute(
        sa.text(
            """
            DELETE FROM modules
            WHERE name = 'Donation Amount Configuration'
              AND parent_id IN (
                  SELECT id FROM modules WHERE name = 'Donations' OR route = '/donations'
              )
            """
        )
    )

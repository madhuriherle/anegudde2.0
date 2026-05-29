"""cleanup_menu_tree

Revision ID: 5e6f7a8b9c01
Revises: 4d5e6f7a8b90
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5e6f7a8b9c01"
down_revision: Union[str, Sequence[str], None] = "4d5e6f7a8b90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _module_id(conn, name, parent_id=None):
    if parent_id is None:
        return conn.execute(
            sa.text("SELECT id FROM modules WHERE name = :name ORDER BY id LIMIT 1"),
            {"name": name},
        ).scalar()

    return conn.execute(
        sa.text(
            """
            SELECT id
            FROM modules
            WHERE name = :name
              AND parent_id = :parent_id
            ORDER BY id
            LIMIT 1
            """
        ),
        {"name": name, "parent_id": parent_id},
    ).scalar()


def upgrade() -> None:
    conn = op.get_bind()
    system_settings_id = _module_id(conn, "System Settings")

    if system_settings_id:
        for display_order, name in enumerate(
            ["Temple Identity", "Receipt Settings", "Data Cleanup"],
            start=1,
        ):
            conn.execute(
                sa.text(
                    """
                    UPDATE modules
                    SET parent_id = :parent_id,
                        display_order = :display_order,
                        status = 1,
                        updated_at = now()
                    WHERE name = :name
                    """
                ),
                {
                    "parent_id": system_settings_id,
                    "display_order": display_order,
                    "name": name,
                },
            )

    debug_id = _module_id(conn, "Debug")
    if debug_id:
        conn.execute(
            sa.text(
                """
                UPDATE modules
                SET status = 0,
                    updated_at = now()
                WHERE id = :debug_id
                """
            ),
            {"debug_id": debug_id},
        )
        conn.execute(
            sa.text(
                """
                UPDATE privileges
                SET status = 0,
                    updated_at = now()
                WHERE privilege_name = 'debug.read'
                   OR module_id = :debug_id
                """
            ),
            {"debug_id": debug_id},
        )


def downgrade() -> None:
    conn = op.get_bind()
    settings_group_id = _module_id(conn, "Master Settings")

    if settings_group_id:
        for display_order, name in enumerate(
            ["Temple Identity", "Receipt Settings", "Data Cleanup"],
            start=2,
        ):
            conn.execute(
                sa.text(
                    """
                    UPDATE modules
                    SET parent_id = :parent_id,
                        display_order = :display_order,
                        updated_at = now()
                    WHERE name = :name
                    """
                ),
                {
                    "parent_id": settings_group_id,
                    "display_order": display_order,
                    "name": name,
                },
            )

    debug_id = _module_id(conn, "Debug")
    if debug_id:
        conn.execute(
            sa.text(
                """
                UPDATE modules
                SET status = 1,
                    updated_at = now()
                WHERE id = :debug_id
                """
            ),
            {"debug_id": debug_id},
        )
        conn.execute(
            sa.text(
                """
                UPDATE privileges
                SET status = 1,
                    updated_at = now()
                WHERE privilege_name = 'debug.read'
                   OR module_id = :debug_id
                """
            ),
            {"debug_id": debug_id},
        )

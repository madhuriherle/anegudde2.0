"""restore_activity_logs_privilege_module

Revision ID: d8f3a6b1c2e4
Revises: c3d4e5f6a7b8
Create Date: 2026-06-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d8f3a6b1c2e4"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _module_id(conn, name: str, parent_id: int | None = None, route: str | None = None):
    if route:
        found = conn.execute(
            sa.text("SELECT id FROM modules WHERE route = :route ORDER BY id LIMIT 1"),
            {"route": route},
        ).scalar()
        if found:
            return found

    if parent_id is None:
        return conn.execute(
            sa.text(
                """
                SELECT id
                FROM modules
                WHERE name = :name AND parent_id IS NULL
                ORDER BY id
                LIMIT 1
                """
            ),
            {"name": name},
        ).scalar()

    return conn.execute(
        sa.text(
            """
            SELECT id
            FROM modules
            WHERE name = :name AND parent_id = :parent_id
            ORDER BY id
            LIMIT 1
            """
        ),
        {"name": name, "parent_id": parent_id},
    ).scalar()


def _ensure_root_module(conn, name: str, icon: str | None, display_order: int):
    existing_id = _module_id(conn, name)
    if existing_id:
        conn.execute(
            sa.text(
                """
                UPDATE modules
                SET icon = :icon,
                    parent_id = NULL,
                    route = NULL,
                    display_order = :display_order,
                    status = 1,
                    min_rank_level = NULL,
                    updated_at = now()
                WHERE id = :id
                """
            ),
            {"id": existing_id, "icon": icon, "display_order": display_order},
        )
        return existing_id

    return conn.execute(
        sa.text(
            """
            INSERT INTO modules
                (name, icon, parent_id, route, display_order, status, min_rank_level, created_at, updated_at, created_by, updated_by)
            VALUES
                (:name, :icon, NULL, NULL, :display_order, 1, NULL, now(), now(), 1, 1)
            RETURNING id
            """
        ),
        {"name": name, "icon": icon, "display_order": display_order},
    ).scalar()


def _ensure_child_module(
    conn,
    *,
    name: str,
    icon: str | None,
    parent_id: int,
    route: str | None,
    display_order: int,
):
    existing_id = _module_id(conn, name, parent_id, route)
    if existing_id:
        conn.execute(
            sa.text(
                """
                UPDATE modules
                SET name = :name,
                    icon = :icon,
                    parent_id = :parent_id,
                    route = :route,
                    display_order = :display_order,
                    status = 1,
                    min_rank_level = NULL,
                    updated_at = now()
                WHERE id = :id
                """
            ),
            {
                "id": existing_id,
                "name": name,
                "icon": icon,
                "parent_id": parent_id,
                "route": route,
                "display_order": display_order,
            },
        )
        return existing_id

    return conn.execute(
        sa.text(
            """
            INSERT INTO modules
                (name, icon, parent_id, route, display_order, status, min_rank_level, created_at, updated_at, created_by, updated_by)
            VALUES
                (:name, :icon, :parent_id, :route, :display_order, 1, NULL, now(), now(), 1, 1)
            RETURNING id
            """
        ),
        {
            "name": name,
            "icon": icon,
            "parent_id": parent_id,
            "route": route,
            "display_order": display_order,
        },
    ).scalar()


def _ensure_privilege(conn, privilege_name: str, module_id: int):
    existing_id = conn.execute(
        sa.text("SELECT id FROM privileges WHERE privilege_name = :name ORDER BY id LIMIT 1"),
        {"name": privilege_name},
    ).scalar()

    description = "Access Activity Logs"
    if existing_id:
        conn.execute(
            sa.text(
                """
                UPDATE privileges
                SET description = :description,
                    module_id = :module_id,
                    status = 1,
                    updated_at = now()
                WHERE id = :id
                """
            ),
            {"id": existing_id, "description": description, "module_id": module_id},
        )
        return

    conn.execute(
        sa.text(
            """
            INSERT INTO privileges
                (privilege_name, description, module_id, status, created_at, updated_at, created_by, updated_by)
            VALUES
                (:name, :description, :module_id, 1, now(), now(), 1, 1)
            """
        ),
        {"name": privilege_name, "description": description, "module_id": module_id},
    )


def upgrade() -> None:
    conn = op.get_bind()

    main_id = _ensure_root_module(conn, "Main Menu", "Menu", 1)
    users_group_id = _ensure_child_module(
        conn,
        name="Users",
        icon="Users",
        parent_id=main_id,
        route=None,
        display_order=4,
    )
    activity_logs_id = _ensure_child_module(
        conn,
        name="Activity Logs",
        icon=None,
        parent_id=users_group_id,
        route="/users/activity",
        display_order=5,
    )
    _ensure_privilege(conn, "activity_logs.read", activity_logs_id)


def downgrade() -> None:
    pass

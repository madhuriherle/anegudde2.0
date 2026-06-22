"""add_office_and_printer_settings_modules

Revision ID: e4f5a6b7c8d9
Revises: d8f3a6b1c2e4
Create Date: 2026-06-22 18:54:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, Sequence[str], None] = "d8f3a6b1c2e4"
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
            sa.text("SELECT id FROM modules WHERE name = :name AND parent_id IS NULL ORDER BY id LIMIT 1"),
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


def _ensure_privilege(conn, privilege_name: str, module_id: int, description: str | None = None):
    existing_id = conn.execute(
        sa.text("SELECT id FROM privileges WHERE privilege_name = :name LIMIT 1"),
        {"name": privilege_name},
    ).scalar()

    if existing_id:
        conn.execute(
            sa.text(
                """
                UPDATE privileges
                SET module_id = :module_id,
                    status = 1,
                    updated_at = now()
                WHERE id = :id
                """
            ),
            {"id": existing_id, "module_id": module_id},
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
        {
            "name": privilege_name,
            "description": description or f"Permission for {privilege_name}",
            "module_id": module_id,
        },
    )


def upgrade() -> None:
    conn = op.get_bind()

    # --- Office module under Main Menu ---
    main_id = _module_id(conn, "Main Menu")
    if main_id:
        office_id = _ensure_child_module(
            conn,
            name="Office",
            icon="Building2",
            parent_id=main_id,
            route="/office",
            display_order=2,
        )
        if office_id:
            _ensure_privilege(conn, "main.office.read", office_id, "Access Office module")

    # --- Printer Settings under System Settings ---
    sys_settings_id = _module_id(conn, "System Settings")
    if sys_settings_id:
        printer_id = _ensure_child_module(
            conn,
            name="Printer Settings",
            icon="Printer",
            parent_id=sys_settings_id,
            route="/settings/printers",
            display_order=4,
        )
        if printer_id:
            _ensure_privilege(conn, "settings.printers.read", printer_id, "Access Printer Settings")
            _ensure_privilege(conn, "settings.printers.write", printer_id, "Modify Printer Settings")


def downgrade() -> None:
    conn = op.get_bind()

    for priv_name in ("settings.printers.read", "settings.printers.write", "main.office.read"):
        conn.execute(
            sa.text(
                """
                UPDATE privileges
                SET status = 0,
                    updated_at = now()
                WHERE privilege_name = :name
                """
            ),
            {"name": priv_name},
        )

    for route in ("/settings/printers", "/office"):
        conn.execute(
            sa.text(
                """
                UPDATE modules
                SET status = 0,
                    updated_at = now()
                WHERE route = :route
                """
            ),
            {"route": route},
        )

"""add_profile_module_and_roles_privileges

Revision ID: a1b9c7d3e5f8
Revises: f0a1b2c3d4e5
Create Date: 2026-06-22 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b9c7d3e5f8"
down_revision: Union[str, Sequence[str], None] = "f0a1b2c3d4e5"
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
        sa.text("SELECT id FROM modules WHERE name = :name AND parent_id = :parent_id ORDER BY id LIMIT 1"),
        {"name": name, "parent_id": parent_id},
    ).scalar()


def _ensure_child_module(conn, *, name, icon, parent_id, route, display_order):
    existing_id = _module_id(conn, name, parent_id, route)
    if existing_id:
        conn.execute(
            sa.text("""
                UPDATE modules                 SET name=:name, icon=:icon, parent_id=:parent_id,
                    route=:route, display_order=:display_order, status=1, updated_at=now()
                WHERE id=:id
            """),
            {"id": existing_id, "name": name, "icon": icon, "parent_id": parent_id,
             "route": route, "display_order": display_order},
        )
        return existing_id
    return conn.execute(
        sa.text("""
            INSERT INTO modules (name, icon, parent_id, route, display_order, status, created_at, updated_at)
            VALUES (:name, :icon, :parent_id, :route, :display_order, 1, now(), now())
            RETURNING id
        """),
        {"name": name, "icon": icon, "parent_id": parent_id, "route": route, "display_order": display_order},
    ).scalar()


def _ensure_privilege(conn, privilege_name: str, module_id: int, description: str | None = None):
    existing_id = conn.execute(
        sa.text("SELECT id FROM privileges WHERE privilege_name = :name LIMIT 1"),
        {"name": privilege_name},
    ).scalar()
    if existing_id:
        conn.execute(
            sa.text("UPDATE privileges SET module_id=:module_id, status=1, updated_at=now() WHERE id=:id"),
            {"id": existing_id, "module_id": module_id},
        )
        return
    conn.execute(
        sa.text("""
            INSERT INTO privileges (privilege_name, description, module_id, status, created_at, updated_at)
            VALUES (:name, :description, :module_id, 1, now(), now())
        """),
        {"name": privilege_name, "description": description or f"Permission for {privilege_name}", "module_id": module_id},
    )


def _ensure_privilege_no_module(conn, privilege_name: str, description: str | None = None):
    existing_id = conn.execute(
        sa.text("SELECT id FROM privileges WHERE privilege_name = :name LIMIT 1"),
        {"name": privilege_name},
    ).scalar()
    if existing_id:
        conn.execute(
            sa.text("UPDATE privileges SET status=1, updated_at=now() WHERE id=:id"),
            {"id": existing_id},
        )
        return
    conn.execute(
        sa.text("""
            INSERT INTO privileges (privilege_name, description, module_id, status, created_at, updated_at)
            VALUES (:name, :description, NULL, 1, now(), now())
        """),
        {"name": privilege_name, "description": description or f"Permission for {privilege_name}"},
    )


def upgrade() -> None:
    conn = op.get_bind()

    # --- Profile module under Main Menu ---
    main_id = _module_id(conn, "Main Menu")
    if main_id:
        profile_id = _ensure_child_module(
            conn,
            name="Profile",
            icon="User",
            parent_id=main_id,
            route="/profile",
            display_order=8,
        )
        if profile_id:
            _ensure_privilege(conn, "profile.read", profile_id, "Access Profile page")

    # --- roles.read/write/delete under Role Management module ---
    role_mgmt_id = _module_id(conn, "Role Management", route="/users/roles")
    if role_mgmt_id:
        for priv_name in ("roles.read", "roles.write", "roles.delete"):
            _ensure_privilege(conn, priv_name, role_mgmt_id, f"Permission for {priv_name}")


def downgrade() -> None:
    conn = op.get_bind()
    for priv_name in ("profile.read", "roles.read", "roles.write", "roles.delete"):
        conn.execute(
            sa.text("UPDATE privileges SET status=0, updated_at=now() WHERE privilege_name=:name"),
            {"name": priv_name},
        )
    conn.execute(
        sa.text("UPDATE modules SET status=0, updated_at=now() WHERE route='/profile'"),
    )

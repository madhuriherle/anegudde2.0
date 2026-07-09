"""seed recycle_bin privileges (read, write, delete)

Revision ID: d5e6f7a8b9c0
Revises: d4bb768c6c82
Create Date: 2026-06-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, Sequence[str], None] = "d4bb768c6c82"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


RECYCLE_BIN_PRIVILEGES = (
    "recycle_bin.read",
    "recycle_bin.write",
    "recycle_bin.delete",
)


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


def _ensure_child_module(conn, *, name, icon, parent_id, route, display_order, min_rank_level=None):
    existing_id = _module_id(conn, name, parent_id, route)
    if existing_id:
        conn.execute(
            sa.text("""
                UPDATE modules
                SET name = :name, icon = :icon, parent_id = :parent_id,
                    route = :route, display_order = :display_order,
                    min_rank_level = :min_rank_level, status = 1, updated_at = now()
                WHERE id = :id
            """),
            {"id": existing_id, "name": name, "icon": icon, "parent_id": parent_id,
             "route": route, "display_order": display_order, "min_rank_level": min_rank_level},
        )
        return existing_id
    return conn.execute(
        sa.text("""
            INSERT INTO modules
                (name, icon, parent_id, route, display_order, min_rank_level, status, created_at, updated_at, created_by, updated_by)
            VALUES
                (:name, :icon, :parent_id, :route, :display_order, :min_rank_level, 1, now(), now(), 1, 1)
            RETURNING id
        """),
        {"name": name, "icon": icon, "parent_id": parent_id, "route": route,
         "display_order": display_order, "min_rank_level": min_rank_level},
    ).scalar()


def _ensure_privilege(conn, privilege_name: str, module_id: int, description: str | None = None):
    existing_id = conn.execute(
        sa.text("SELECT id FROM privileges WHERE privilege_name = :name LIMIT 1"),
        {"name": privilege_name},
    ).scalar()
    if existing_id:
        conn.execute(
            sa.text("UPDATE privileges SET module_id = :module_id, status = 1, updated_at = now() WHERE id = :id"),
            {"id": existing_id, "module_id": module_id},
        )
        return
    conn.execute(
        sa.text("""
            INSERT INTO privileges (privilege_name, description, module_id, status, created_at, updated_at, created_by, updated_by)
            VALUES (:name, :description, :module_id, 1, now(), now(), 1, 1)
        """),
        {"name": privilege_name, "description": description or f"Permission for {privilege_name}", "module_id": module_id},
    )


def upgrade() -> None:
    conn = op.get_bind()

    # Find the Master Settings parent module
    master_settings_id = _module_id(conn, "Master Settings")
    if not master_settings_id:
        # Fallback: try "Main Menu" or just skip
        print("Master Settings module not found, skipping recycle bin module creation")
        return

    # Create Recycle Bin module under Master Settings, rank-1-gated like Data Cleanup
    recycle_bin_id = _ensure_child_module(
        conn,
        name="Recycle Bin",
        icon="Trash2",
        parent_id=master_settings_id,
        route="/settings/recycle-bin",
        display_order=7,
        min_rank_level=1,
    )

    if recycle_bin_id:
        for priv_name in RECYCLE_BIN_PRIVILEGES:
            _ensure_privilege(conn, priv_name, recycle_bin_id)


def downgrade() -> None:
    conn = op.get_bind()

    for priv_name in RECYCLE_BIN_PRIVILEGES:
        conn.execute(
            sa.text("UPDATE privileges SET status = 0, updated_at = now() WHERE privilege_name = :name"),
            {"name": priv_name},
        )

    conn.execute(
        sa.text("UPDATE modules SET status = 0, updated_at = now() WHERE route = '/settings/recycle-bin'"),
    )

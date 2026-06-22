"""add_role_management_privileges

Revision ID: b6e3f1a2c4d5
Revises: a7b8c9d0e1f2, 2a93dddd26f8
Create Date: 2026-06-19 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b6e3f1a2c4d5"
down_revision: Union[str, Sequence[str], None] = ("a7b8c9d0e1f2", "2a93dddd26f8")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ROLE_PRIVILEGES = ("roles.read", "roles.write", "roles.delete")


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


def _ensure_role_management_module(conn, users_group_id: int):
    existing_id = _module_id(conn, "Role Management", users_group_id, "/users/roles")
    if existing_id:
        conn.execute(
            sa.text(
                """
                UPDATE modules
                SET name = 'Role Management',
                    parent_id = :users_group_id,
                    route = '/users/roles',
                    display_order = 2,
                    status = 1,
                    updated_at = now()
                WHERE id = :id
                """
            ),
            {"id": existing_id, "users_group_id": users_group_id},
        )
        return existing_id

    return conn.execute(
        sa.text(
            """
            INSERT INTO modules
                (name, icon, parent_id, route, display_order, status, created_at, updated_at, created_by, updated_by)
            VALUES
                ('Role Management', NULL, :users_group_id, '/users/roles', 2, 1, now(), now(), 1, 1)
            RETURNING id
            """
        ),
        {"users_group_id": users_group_id},
    ).scalar()


def _ensure_privilege(conn, privilege_name: str, module_id: int):
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
            "description": f"Permission for {privilege_name}",
            "module_id": module_id,
        },
    )


def upgrade() -> None:
    conn = op.get_bind()
    users_group_id = _module_id(conn, "Users")
    if not users_group_id:
        return

    role_module_id = _ensure_role_management_module(conn, users_group_id)
    for privilege_name in ROLE_PRIVILEGES:
        _ensure_privilege(conn, privilege_name, role_module_id)

    conn.execute(
        sa.text(
            """
            UPDATE modules
            SET display_order = CASE
                WHEN name = 'User Management' THEN 1
                WHEN name = 'Role Management' THEN 2
                WHEN name = 'User Privileges' THEN 3
                WHEN name = 'Module Management' THEN 4
                WHEN name = 'Activity Logs' THEN 5
                ELSE display_order
            END,
            updated_at = now()
            WHERE parent_id = :users_group_id
            """
        ),
        {"users_group_id": users_group_id},
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE privileges
            SET status = 0,
                updated_at = now()
            WHERE privilege_name = ANY(:privileges)
            """
        ),
        {"privileges": list(ROLE_PRIVILEGES)},
    )

    conn.execute(
        sa.text(
            """
            UPDATE modules
            SET status = 0,
                updated_at = now()
            WHERE route = '/users/roles'
              AND name = 'Role Management'
            """
        )
    )

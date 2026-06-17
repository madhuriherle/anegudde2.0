"""enforce_one_house_module_tree

Revision ID: 9c1d2e3f4a56
Revises: 6b0eacf7b3f7
Create Date: 2026-06-17 10:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9c1d2e3f4a56"
down_revision: Union[str, Sequence[str], None] = "6b0eacf7b3f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CANTEEN_PRIVILEGES = (
    "dashboard.read",
    "purchases.read",
    "purchase_returns.read",
    "consumptions.read",
    "donations.read",
    "vendors.read",
    "items.read",
    "item_categories.read",
    "menu_items.read",
    "reports.stock_summary.read",
    "reports.canteen_summary.read",
    "reports.manpower.read",
    "reports.donations.read",
    "reports.purchases.read",
    "reports.tokens.read",
    "tokens.read",
)


MODULE_PRIVILEGE_MAP = {
    "Canteen Module": ("main.canteen.read",),
    "Wastages": ("wastages.read", "wastages.write", "wastages.delete"),
    "Item Type": ("item_types.read", "item_types.write", "item_types.delete"),
    "Devotees": ("devotees.read", "devotees.write", "devotees.delete"),
    "Module Management": ("users.modules.read", "users.modules.write", "users.modules.delete"),
}


def _column_exists(conn, table_name, column_name):
    return conn.execute(
        sa.text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = :table_name
              AND column_name = :column_name
            LIMIT 1
            """
        ),
        {"table_name": table_name, "column_name": column_name},
    ).scalar() is not None


def _constraint_exists(conn, table_name, constraint_name):
    return conn.execute(
        sa.text(
            """
            SELECT 1
            FROM information_schema.table_constraints
            WHERE table_schema = current_schema()
              AND table_name = :table_name
              AND constraint_name = :constraint_name
            LIMIT 1
            """
        ),
        {"table_name": table_name, "constraint_name": constraint_name},
    ).scalar() is not None


def _ensure_roles_module_column(conn):
    if not _column_exists(conn, "roles", "module_id"):
        op.add_column("roles", sa.Column("module_id", sa.Integer(), nullable=True))

    constraint_name = "fk_roles_module_id_modules"
    if not _constraint_exists(conn, "roles", constraint_name):
        op.create_foreign_key(
            constraint_name,
            "roles",
            "modules",
            ["module_id"],
            ["id"],
        )


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


def _ensure_privilege(conn, privilege_name, module_id):
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
        return existing_id

    return conn.execute(
        sa.text(
            """
            INSERT INTO privileges
                (privilege_name, description, module_id, status, created_at, updated_at, created_by, updated_by)
            VALUES
                (:name, :description, :module_id, 1, now(), now(), 1, 1)
            RETURNING id
            """
        ),
        {
            "name": privilege_name,
            "description": f"Permission for {privilege_name}",
            "module_id": module_id,
        },
    ).scalar()


def upgrade() -> None:
    conn = op.get_bind()
    _ensure_roles_module_column(conn)

    main_id = _module_id(conn, "Main Menu")
    if not main_id:
        return

    canteen_id = _module_id(conn, "Canteen Module")
    if not canteen_id:
        canteen_id = conn.execute(
            sa.text(
                """
                INSERT INTO modules
                    (name, icon, parent_id, route, display_order, status, created_at, updated_at, created_by, updated_by)
                VALUES
                    ('Canteen Module', 'UtensilsCrossed', :main_id, NULL, 2, 1, now(), now(), 1, 1)
                RETURNING id
                """
            ),
            {"main_id": main_id},
        ).scalar()

    conn.execute(
        sa.text(
            """
            UPDATE modules
            SET parent_id = :main_id,
                opens_module_id = NULL,
                route = NULL,
                icon = COALESCE(icon, 'UtensilsCrossed'),
                display_order = 2,
                status = 1,
                updated_at = now()
            WHERE id = :canteen_id
            """
        ),
        {"main_id": main_id, "canteen_id": canteen_id},
    )

    launcher_ids = [
        row[0]
        for row in conn.execute(
            sa.text(
                """
                SELECT id
                FROM modules
                WHERE id <> :canteen_id
                  AND (
                    opens_module_id = :canteen_id
                    OR (parent_id = :main_id AND name IN ('Canteen', 'Canteen Launcher'))
                  )
                """
            ),
            {"main_id": main_id, "canteen_id": canteen_id},
        ).fetchall()
    ]

    if launcher_ids:
        conn.execute(
            sa.text(
                """
                UPDATE roles
                SET module_id = :canteen_id,
                    updated_at = now()
                WHERE module_id = ANY(:launcher_ids)
                """
            ),
            {"canteen_id": canteen_id, "launcher_ids": launcher_ids},
        )
        conn.execute(
            sa.text(
                """
                UPDATE privileges
                SET module_id = :canteen_id,
                    updated_at = now()
                WHERE module_id = ANY(:launcher_ids)
                """
            ),
            {"canteen_id": canteen_id, "launcher_ids": launcher_ids},
        )
        conn.execute(
            sa.text(
                """
                UPDATE modules
                SET status = 0,
                    opens_module_id = NULL,
                    route = NULL,
                    updated_at = now()
                WHERE id = ANY(:launcher_ids)
                """
            ),
            {"launcher_ids": launcher_ids},
        )

    conn.execute(
        sa.text(
            """
            UPDATE modules
            SET display_order = CASE
                WHEN id = :canteen_id THEN 2
                WHEN name = 'Home' THEN 1
                WHEN name = 'Office' THEN 3
                WHEN name = 'Users' THEN 4
                WHEN name = 'Reports' THEN 5
                WHEN name = 'Master Settings' THEN 6
                ELSE display_order
            END,
            updated_at = now()
            WHERE parent_id = :main_id
            """
        ),
        {"main_id": main_id, "canteen_id": canteen_id},
    )

    for module_name, privilege_names in MODULE_PRIVILEGE_MAP.items():
        module_id = canteen_id if module_name == "Canteen Module" else _module_id(conn, module_name)
        if not module_id:
            continue

        status = 1
        min_rank_level = None
        if module_name == "Module Management":
            min_rank_level = 1

        conn.execute(
            sa.text(
                """
                UPDATE modules
                SET status = :status,
                    min_rank_level = COALESCE(:min_rank_level, min_rank_level),
                    updated_at = now()
                WHERE id = :module_id
                """
            ),
            {"module_id": module_id, "status": status, "min_rank_level": min_rank_level},
        )
        for privilege_name in privilege_names:
            _ensure_privilege(conn, privilege_name, module_id)

    main_canteen_privilege_id = _ensure_privilege(conn, "main.canteen.read", canteen_id)

    role_ids = [
        row[0]
        for row in conn.execute(
            sa.text(
                """
                SELECT DISTINCT rp.role_id
                FROM role_privileges rp
                JOIN privileges p ON p.id = rp.privilege_id
                WHERE rp.status = 1
                  AND p.privilege_name = ANY(:privilege_names)
                """
            ),
            {"privilege_names": list(CANTEEN_PRIVILEGES)},
        ).fetchall()
    ]

    for role_id in role_ids:
        existing_id = conn.execute(
            sa.text(
                """
                SELECT id
                FROM role_privileges
                WHERE role_id = :role_id
                  AND privilege_id = :privilege_id
                LIMIT 1
                """
            ),
            {"role_id": role_id, "privilege_id": main_canteen_privilege_id},
        ).scalar()

        if existing_id:
            conn.execute(
                sa.text(
                    """
                    UPDATE role_privileges
                    SET status = 1,
                        updated_at = now()
                    WHERE id = :id
                    """
                ),
                {"id": existing_id},
            )
        else:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO role_privileges
                        (role_id, privilege_id, status, created_at, updated_at, created_by, updated_by)
                    VALUES
                        (:role_id, :privilege_id, 1, now(), now(), 1, 1)
                    """
                ),
                {"role_id": role_id, "privilege_id": main_canteen_privilege_id},
            )


def downgrade() -> None:
    conn = op.get_bind()
    main_id = _module_id(conn, "Main Menu")
    canteen_id = _module_id(conn, "Canteen Module")
    if not main_id or not canteen_id:
        return

    conn.execute(
        sa.text(
            """
            UPDATE modules
            SET parent_id = NULL,
                display_order = 2,
                updated_at = now()
            WHERE id = :canteen_id
            """
        ),
        {"canteen_id": canteen_id},
    )

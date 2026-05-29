"""add_opens_module_id

Revision ID: 8b9c0d1e2f34
Revises: 7a8b9c0d1e23
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8b9c0d1e2f34"
down_revision: Union[str, Sequence[str], None] = "7a8b9c0d1e23"
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


def upgrade() -> None:
    conn = op.get_bind()
    op.add_column("modules", sa.Column("opens_module_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_modules_opens_module_id_modules",
        "modules",
        "modules",
        ["opens_module_id"],
        ["id"],
    )

    main_id = _module_id(conn, "Main Menu")
    canteen_root_id = _module_id(conn, "Canteen Module")

    if not main_id or not canteen_root_id:
        return

    canteen_launcher_id = _module_id(conn, "Canteen", main_id)
    if not canteen_launcher_id:
        canteen_launcher_id = conn.execute(
            sa.text(
                """
                INSERT INTO modules
                    (name, icon, parent_id, opens_module_id, route, display_order, status, created_at, updated_at, created_by, updated_by)
                VALUES
                    ('Canteen', 'UtensilsCrossed', :parent_id, :opens_module_id, '/canteen', 2, 1, now(), now(), 1, 1)
                RETURNING id
                """
            ),
            {"parent_id": main_id, "opens_module_id": canteen_root_id},
        ).scalar()
    else:
        conn.execute(
            sa.text(
                """
                UPDATE modules
                SET icon = COALESCE(icon, 'UtensilsCrossed'),
                    opens_module_id = :opens_module_id,
                    route = '/canteen',
                    display_order = 2,
                    status = 1,
                    updated_at = now()
                WHERE id = :id
                """
            ),
            {"id": canteen_launcher_id, "opens_module_id": canteen_root_id},
        )

    conn.execute(
        sa.text(
            """
            UPDATE modules
            SET display_order = CASE name
                WHEN 'Home' THEN 1
                WHEN 'Canteen' THEN 2
                WHEN 'Office' THEN 3
                WHEN 'Users' THEN 4
                WHEN 'Reports' THEN 5
                WHEN 'Master Settings' THEN 6
                ELSE display_order
            END,
            updated_at = now()
            WHERE parent_id = :main_id
            """
        ),
        {"main_id": main_id},
    )

    main_canteen_privilege_id = conn.execute(
        sa.text(
            """
            SELECT id FROM privileges
            WHERE privilege_name = 'main.canteen.read'
            LIMIT 1
            """
        )
    ).scalar()
    if main_canteen_privilege_id:
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
            {"id": main_canteen_privilege_id, "module_id": canteen_launcher_id},
        )

        role_ids = [
            row[0]
            for row in conn.execute(
                sa.text(
                    """
                    SELECT DISTINCT rp.role_id
                    FROM role_privileges rp
                    JOIN privileges p ON p.id = rp.privilege_id
                    WHERE rp.status = 1
                      AND p.privilege_name = ANY(:privileges)
                    """
                ),
                {"privileges": list(CANTEEN_PRIVILEGES)},
            ).fetchall()
        ]
        for role_id in role_ids:
            exists = conn.execute(
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
            if exists:
                conn.execute(
                    sa.text(
                        """
                        UPDATE role_privileges
                        SET status = 1,
                            updated_at = now()
                        WHERE id = :id
                        """
                    ),
                    {"id": exists},
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
    canteen_launcher_id = _module_id(conn, "Canteen", main_id) if main_id else None

    if canteen_launcher_id:
        dashboard_id = conn.execute(
            sa.text("SELECT id FROM modules WHERE name = 'Dashboard' AND route = '/canteen' AND status = 1 ORDER BY id LIMIT 1")
        ).scalar()
        if dashboard_id:
            conn.execute(
                sa.text(
                    """
                    UPDATE privileges
                    SET module_id = :dashboard_id,
                        updated_at = now()
                    WHERE privilege_name = 'main.canteen.read'
                    """
                ),
                {"dashboard_id": dashboard_id},
            )
        conn.execute(
            sa.text("UPDATE modules SET status = 0, updated_at = now() WHERE id = :id"),
            {"id": canteen_launcher_id},
        )

    op.drop_constraint("fk_modules_opens_module_id_modules", "modules", type_="foreignkey")
    op.drop_column("modules", "opens_module_id")

"""normalize_module_privilege_links

Revision ID: 3c4d5e6f7a80
Revises: 2d9e8f7a6b31
Create Date: 2026-05-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3c4d5e6f7a80"
down_revision: Union[str, Sequence[str], None] = "2d9e8f7a6b31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MODULES = [
    ("main", "Main Menu", None, None, "Menu", 1),
    ("home", "Home", "main", "/", "Home", 1),
    ("canteen", "Canteen Module", None, None, "UtensilsCrossed", 2),
    ("dashboard", "Dashboard", "canteen", "/canteen", "UtensilsCrossed", 1),
    ("purchase", "Purchase", "canteen", None, "ShoppingCart", 2),
    ("purchases", "Purchase Entry", "purchase", "/purchases", None, 1),
    ("purchase_returns", "Purchase Returns", "purchase", "/purchases/returns", None, 2),
    ("daily_usage", "Daily Usage Entry", "canteen", "/daily-usage", "Package", 3),
    # ("wastages", "Wastages", "canteen", "/wastages", "Trash2", 4),  # merged into daily_usage
    ("donations", "Donations", "canteen", "/donations", "Heart", 5),
    ("donations.amount_config", "Donation Amount Configuration", "donations", None, "Settings", 1),
    ("vendors", "Vendors", "canteen", "/vendors", "Users", 6),
    ("items_group", "Items", "canteen", None, "Package", 7),
    ("item_categories", "Category", "items_group", "/items/categories", None, 1),
    ("item_types", "Item Type", "items_group", None, None, 2),
    ("items", "Raw Item", "items_group", "/items/rawitem", None, 3),
    ("menu_items", "Menu Item", "items_group", "/items/menu-items", None, 4),
    ("devotees", "Devotees", "donations", "/devotees", "Users", 2),
    ("users_group", "Users", "main", None, "Users", 4),
    ("users.management", "User Management", "users_group", "/users", None, 1),
    ("users.privileges", "User Privileges", "users_group", "/users/privileges", None, 2),
    ("users.modules", "Module Management", "users_group", "/settings/modules", None, 3),
    ("activity_logs", "Activity Logs", "users_group", "/users/activity", None, 4),
    ("settings_group", "Master Settings", "main", None, "Settings", 6),
    ("settings.management", "System Settings", "settings_group", "/settings", None, 1),
    ("settings.temple_identity", "Temple Identity", "settings.management", "/settings/temple", None, 1),
    ("settings.receipt_settings", "Receipt Settings", "settings.management", "/settings/receipt", None, 2),
    ("settings.data_cleanup", "Data Cleanup", "settings.management", "/settings/cleanup", None, 3),
    ("units", "Units", "settings_group", "/settings/units", None, 5),
    ("donation_types", "Donation Type", "settings_group", "/settings/donation-types", None, 6),
    ("reports_group", "Reports", "canteen", None, "BarChart3", 8),
    ("reports.stock_summary", "Stock Summary", "reports_group", "/reports/stock-summary", None, 1),
    ("reports.canteen_summary", "Canteen Summary", "reports_group", "/reports/canteen-summary", None, 2),
    ("reports.manpower", "Manpower Report", "reports_group", "/reports/manpower", None, 3),
    ("reports.donations", "Donation Report", "reports_group", "/reports/donations", None, 4),
    ("reports.tokens", "Token Issued Report", "reports_group", "/reports/tokens", None, 5),
    ("reports.purchases", "Purchase Report", "reports_group", "/reports/purchases", None, 6),
    # ("reports.consumptions", "Consumption Report", "reports_group", None, None, 7),  # no UI
    # ("reports.wastages", "Wastage Report", "reports_group", None, None, 8),  # no UI
    ("tokens", "Token Generation", "reports.tokens", None, None, 1),
]


PRIVILEGE_ACTIONS = {
    "main.home": ("read",),
    "dashboard": ("read",),
    "purchases": ("read", "write", "delete"),
    "purchase_returns": ("read", "write", "delete"),
    "daily_usage": ("read", "write", "delete"),
    # "wastages": ("read",),  # merged into daily_usage
    "donations": ("read", "write", "delete"),
    "donations.amount_config": ("read", "write", "delete"),
    "devotees": ("read", "write", "delete"),
    "vendors": ("read", "write", "delete"),
    "items": ("read", "write", "delete"),
    "item_categories": ("read", "write", "delete"),
    "item_types": ("read", "write", "delete"),
    "menu_items": ("read", "write", "delete"),
    "units": ("read", "write", "delete"),
    "donation_types": ("read", "write", "delete"),
    "settings": ("read", "write", "delete"),
    "settings.management": ("read", "write"),
    "settings.temple_identity": ("read", "write"),
    "settings.receipt_settings": ("read", "write"),
    "settings.data_cleanup": ("read", "write"),
    "users": ("read", "write", "delete"),
    "users.management": ("read", "write", "delete"),
    "users.privileges": ("read", "write"),
    "users.modules": ("read", "write", "delete"),
    "activity_logs": ("read",),
    "reports": ("read",),
    "reports.stock_summary": ("read",),
    "reports.canteen_summary": ("read",),
    "reports.manpower": ("read",),
    "reports.donations": ("read",),
    "reports.tokens": ("read",),
    "reports.purchases": ("read",),
    # "reports.consumptions": ("read",),  # no UI
    # "reports.wastages": ("read",),  # no UI
    "tokens": ("read", "write"),
}


PREFIX_MODULE_KEY = {
    "main.home": "home",
    "dashboard": "dashboard",
    "purchases": "purchases",
    "purchase_returns": "purchase_returns",
    "daily_usage": "daily_usage",
    "wastages": "wastages",
    "donations": "donations",
    "donations.amount_config": "donations.amount_config",
    "devotees": "devotees",
    "vendors": "vendors",
    "items": "items",
    "item_categories": "item_categories",
    "item_types": "item_types",
    "menu_items": "menu_items",
    "units": "units",
    "donation_types": "donation_types",
    "settings": "settings.management",
    "settings.management": "settings.management",
    "settings.temple_identity": "settings.temple_identity",
    "settings.receipt_settings": "settings.receipt_settings",
    "settings.data_cleanup": "settings.data_cleanup",
    "users": "users.management",
    "users.management": "users.management",
    "users.privileges": "users.privileges",
    "users.modules": "users.modules",
    "activity_logs": "activity_logs",
    "reports": "reports_group",
    "reports.stock_summary": "reports.stock_summary",
    "reports.canteen_summary": "reports.canteen_summary",
    "reports.manpower": "reports.manpower",
    "reports.donations": "reports.donations",
    "reports.tokens": "reports.tokens",
    "reports.purchases": "reports.purchases",
    # "reports.consumptions": "reports.consumptions",
    # "reports.wastages": "reports.wastages",
    "tokens": "tokens",
}


def _find_module(conn, name, parent_id, route):
    if route:
        found = conn.execute(sa.text("SELECT id FROM modules WHERE route = :route LIMIT 1"), {"route": route}).scalar()
        if found:
            return found

    if parent_id is None:
        return conn.execute(
            sa.text("SELECT id FROM modules WHERE name = :name AND parent_id IS NULL LIMIT 1"),
            {"name": name},
        ).scalar()

    return conn.execute(
        sa.text("SELECT id FROM modules WHERE name = :name AND parent_id = :parent_id LIMIT 1"),
        {"name": name, "parent_id": parent_id},
    ).scalar()


def _ensure_module(conn, name, parent_id, route, icon, display_order):
    module_id = _find_module(conn, name, parent_id, route)
    if module_id:
        conn.execute(
            sa.text(
                """
                UPDATE modules
                SET name = :name,
                    icon = COALESCE(:icon, icon),
                    parent_id = :parent_id,
                    route = :route,
                    display_order = :display_order,
                    status = 1,
                    updated_at = now()
                WHERE id = :id
                """
            ),
            {
                "id": module_id,
                "name": name,
                "icon": icon,
                "parent_id": parent_id,
                "route": route,
                "display_order": display_order,
            },
        )
        return module_id

    return conn.execute(
        sa.text(
            """
            INSERT INTO modules
                (name, icon, parent_id, route, display_order, status, created_at, updated_at, created_by, updated_by)
            VALUES
                (:name, :icon, :parent_id, :route, :display_order, 1, now(), now(), 1, 1)
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


def _ensure_privilege(conn, privilege_name, module_id):
    description = f"Permission for {privilege_name}"
    existing = conn.execute(
        sa.text("SELECT id FROM privileges WHERE privilege_name = :privilege_name"),
        {"privilege_name": privilege_name},
    ).scalar()

    if existing:
        conn.execute(
            sa.text(
                """
                UPDATE privileges
                SET module_id = :module_id,
                    description = COALESCE(description, :description),
                    status = 1,
                    updated_at = now()
                WHERE id = :id
                """
            ),
            {"id": existing, "module_id": module_id, "description": description},
        )
        return

    conn.execute(
        sa.text(
            """
            INSERT INTO privileges
                (privilege_name, description, status, created_at, updated_at, created_by, updated_by, module_id)
            VALUES
                (:privilege_name, :description, 1, now(), now(), 1, 1, :module_id)
            """
        ),
        {"privilege_name": privilege_name, "description": description, "module_id": module_id},
    )


def upgrade() -> None:
    conn = op.get_bind()
    module_ids = {}

    for key, name, parent_key, route, icon, display_order in MODULES:
        parent_id = module_ids.get(parent_key) if parent_key else None
        module_ids[key] = _ensure_module(conn, name, parent_id, route, icon, display_order)

    for prefix, actions in PRIVILEGE_ACTIONS.items():
        module_key = PREFIX_MODULE_KEY[prefix]
        module_id = module_ids[module_key]
        for action in actions:
            _ensure_privilege(conn, f"{prefix}.{action}", module_id)


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE privileges
            SET module_id = NULL,
                updated_at = now()
            WHERE privilege_name IN (
                'main.home.read'
            )
            """
        )
    )

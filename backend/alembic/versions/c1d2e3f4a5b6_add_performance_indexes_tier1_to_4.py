"""add performance indexes tier1 to 4

Revision ID: c1d2e3f4a5b6
Revises: abf93fce7c2f
Create Date: 2026-07-14 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "abf93fce7c2f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── TIER 1: High-priority single-column indexes ──
    op.create_index("ix_purchase_entries_created_at", "purchase_entries", ["created_at"], unique=False)
    op.create_index("ix_consumption_entries_created_at", "consumption_entries", ["created_at"], unique=False)
    op.create_index("ix_wastage_entries_created_at", "wastage_entries", ["created_at"], unique=False)
    op.create_index("ix_donation_entries_created_at", "donation_entries", ["created_at"], unique=False)
    op.create_index("ix_items_current_stock", "items", ["current_stock"], unique=False)
    op.create_index("ix_activity_logs_activity_status", "activity_logs", ["activity_status"], unique=False)
    op.create_index("ix_activity_logs_method", "activity_logs", ["method"], unique=False)
    op.create_index("ix_activity_logs_client_type", "activity_logs", ["client_type"], unique=False)

    # ── TIER 2: Composite indexes for hot query paths ──
    op.create_index("ix_stock_ledger_item_txn", "stock_ledger", ["item_id", "txn_date"], unique=False)
    op.create_index("ix_purchase_entries_del_date", "purchase_entries", ["is_deleted", "purchase_date"], unique=False)
    op.create_index("ix_consumption_entries_del_date", "consumption_entries", ["is_deleted", "usage_date"], unique=False)
    op.create_index("ix_wastage_entries_del_date", "wastage_entries", ["is_deleted", "wastage_date"], unique=False)
    op.create_index("ix_donation_entries_del_date_status", "donation_entries", ["is_deleted", "donation_date", "status"], unique=False)
    op.create_index("ix_activity_logs_method_at", "activity_logs", ["method", "activity_at"], unique=False)

    # ── TIER 3: Medium-priority sort/search indexes ──
    op.create_index("ix_modules_status", "modules", ["status"], unique=False)
    op.create_index("ix_modules_parent_id", "modules", ["parent_id"], unique=False)
    op.create_index("ix_modules_display_order", "modules", ["display_order"], unique=False)
    op.create_index("ix_roles_rank_level", "roles", ["rank_level"], unique=False)
    op.create_index("ix_menu_items_dish_name", "menu_items", ["dish_name"], unique=False)
    op.create_index("ix_financial_years_is_active", "financial_years", ["is_active"], unique=False)
    op.create_index("ix_financial_years_status", "financial_years", ["status"], unique=False)
    op.create_index("ix_privileges_status", "privileges", ["status"], unique=False)
    op.create_index("ix_item_prices_created_at", "item_prices", ["created_at"], unique=False)
    op.create_index("ix_devotees_updated_at", "devotees", ["updated_at"], unique=False)
    op.create_index("ix_vendors_created_at", "vendors", ["created_at"], unique=False)

    # ── TIER 4: pg_trgm extension + GIN indexes for ILIKE search ──
    conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_vendors_name_trgm ON vendors USING gin (vendor_name gin_trgm_ops)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_vendors_contact_trgm ON vendors USING gin (contact_number gin_trgm_ops)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_vendors_person_trgm ON vendors USING gin (contact_person gin_trgm_ops)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_vendors_city_trgm ON vendors USING gin (city gin_trgm_ops)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_donation_entries_devotee_name_trgm ON donation_entries USING gin (devotee_name gin_trgm_ops)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_donation_entries_phone_trgm ON donation_entries USING gin (phone_number gin_trgm_ops)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_donation_entries_remarks_trgm ON donation_entries USING gin (remarks gin_trgm_ops)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_devotees_name_trgm ON devotees USING gin (devotee_name gin_trgm_ops)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_devotees_email_trgm ON devotees USING gin (email gin_trgm_ops)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_devotees_city_trgm ON devotees USING gin (city gin_trgm_ops)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_devotees_pincode_trgm ON devotees USING gin (pincode gin_trgm_ops)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_users_full_name_trgm ON users USING gin (full_name gin_trgm_ops)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_users_email_trgm ON users USING gin (email gin_trgm_ops)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_item_categories_name_trgm ON item_categories USING gin (category_name gin_trgm_ops)"))


def downgrade() -> None:
    conn = op.get_bind()

    # ── TIER 4 ──
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_item_categories_name_trgm"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_users_email_trgm"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_users_full_name_trgm"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_devotees_pincode_trgm"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_devotees_city_trgm"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_devotees_email_trgm"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_devotees_name_trgm"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_donation_entries_remarks_trgm"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_donation_entries_phone_trgm"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_donation_entries_devotee_name_trgm"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_vendors_city_trgm"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_vendors_person_trgm"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_vendors_contact_trgm"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_vendors_name_trgm"))

    # ── TIER 3 ──
    op.drop_index("ix_vendors_created_at", table_name="vendors")
    op.drop_index("ix_devotees_updated_at", table_name="devotees")
    op.drop_index("ix_item_prices_created_at", table_name="item_prices")
    op.drop_index("ix_privileges_status", table_name="privileges")
    op.drop_index("ix_financial_years_status", table_name="financial_years")
    op.drop_index("ix_financial_years_is_active", table_name="financial_years")
    op.drop_index("ix_menu_items_dish_name", table_name="menu_items")
    op.drop_index("ix_roles_rank_level", table_name="roles")
    op.drop_index("ix_modules_display_order", table_name="modules")
    op.drop_index("ix_modules_parent_id", table_name="modules")
    op.drop_index("ix_modules_status", table_name="modules")

    # ── TIER 2 ──
    op.drop_index("ix_activity_logs_method_at", table_name="activity_logs")
    op.drop_index("ix_donation_entries_del_date_status", table_name="donation_entries")
    op.drop_index("ix_wastage_entries_del_date", table_name="wastage_entries")
    op.drop_index("ix_consumption_entries_del_date", table_name="consumption_entries")
    op.drop_index("ix_purchase_entries_del_date", table_name="purchase_entries")
    op.drop_index("ix_stock_ledger_item_txn", table_name="stock_ledger")

    # ── TIER 1 ──
    op.drop_index("ix_activity_logs_client_type", table_name="activity_logs")
    op.drop_index("ix_activity_logs_method", table_name="activity_logs")
    op.drop_index("ix_activity_logs_activity_status", table_name="activity_logs")
    op.drop_index("ix_items_current_stock", table_name="items")
    op.drop_index("ix_donation_entries_created_at", table_name="donation_entries")
    op.drop_index("ix_wastage_entries_created_at", table_name="wastage_entries")
    op.drop_index("ix_consumption_entries_created_at", table_name="consumption_entries")
    op.drop_index("ix_purchase_entries_created_at", table_name="purchase_entries")

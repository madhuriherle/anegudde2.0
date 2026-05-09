"""harden schema: numeric stock fields, checks, indexes, and token pk normalization

Revision ID: 6f2a9d1c3e77
Revises: 019121aef244
Create Date: 2026-05-09 12:40:00
"""

from alembic import op
import sqlalchemy as sa


revision = "6f2a9d1c3e77"
down_revision = "019121aef244"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Numeric type fixes
    op.alter_column(
        "items",
        "opening_stock",
        existing_type=sa.String(length=50),
        type_=sa.Numeric(15, 3),
        postgresql_using="COALESCE(NULLIF(TRIM(opening_stock), ''), '0')::numeric(15,3)",
        existing_nullable=False,
    )
    op.alter_column(
        "items",
        "current_stock",
        existing_type=sa.String(length=50),
        type_=sa.Numeric(15, 3),
        postgresql_using="COALESCE(NULLIF(TRIM(current_stock), ''), '0')::numeric(15,3)",
        existing_nullable=False,
    )
    op.alter_column(
        "vendors",
        "opening_balance",
        existing_type=sa.Text(),
        type_=sa.Numeric(15, 3),
        postgresql_using="COALESCE(NULLIF(TRIM(opening_balance), ''), '0')::numeric(15,3)",
        existing_nullable=False,
    )

    # 2) Non-negative checks
    op.execute("ALTER TABLE items ADD CONSTRAINT ck_items_opening_stock_non_negative CHECK (opening_stock >= 0)")
    op.execute("ALTER TABLE items ADD CONSTRAINT ck_items_current_stock_non_negative CHECK (current_stock >= 0)")
    op.execute("ALTER TABLE item_prices ADD CONSTRAINT ck_item_prices_price_non_negative CHECK (price >= 0)")
    op.execute("ALTER TABLE purchase_items ADD CONSTRAINT ck_purchase_items_quantity_non_negative CHECK (quantity >= 0)")
    op.execute("ALTER TABLE purchase_items ADD CONSTRAINT ck_purchase_items_price_non_negative CHECK (price >= 0)")
    op.execute("ALTER TABLE purchase_items ADD CONSTRAINT ck_purchase_items_line_total_non_negative CHECK (line_total >= 0)")
    op.execute("ALTER TABLE vendor_payments ADD CONSTRAINT ck_vendor_payments_amount_non_negative CHECK (amount >= 0)")
    op.execute("ALTER TABLE wastage_items ADD CONSTRAINT ck_wastage_items_quantity_non_negative CHECK (quantity >= 0)")
    op.execute("ALTER TABLE wastage_items ADD CONSTRAINT ck_wastage_items_approx_amount_non_negative CHECK (approx_amount >= 0)")
    op.execute("ALTER TABLE stock_ledger ADD CONSTRAINT ck_stock_ledger_qty_in_non_negative CHECK (qty_in >= 0)")
    op.execute("ALTER TABLE stock_ledger ADD CONSTRAINT ck_stock_ledger_qty_out_non_negative CHECK (qty_out >= 0)")
    op.execute("ALTER TABLE stock_ledger ADD CONSTRAINT ck_stock_ledger_unit_cost_non_negative CHECK (unit_cost >= 0)")
    op.execute("ALTER TABLE stock_ledger ADD CONSTRAINT ck_stock_ledger_value_in_non_negative CHECK (value_in >= 0)")
    op.execute("ALTER TABLE stock_ledger ADD CONSTRAINT ck_stock_ledger_value_out_non_negative CHECK (value_out >= 0)")
    op.execute("ALTER TABLE stock_ledger ADD CONSTRAINT ck_stock_ledger_current_value_non_negative CHECK (current_value >= 0)")

    # 3) Status checks (0/1)
    for table in [
        "roles", "privileges", "role_privileges", "users", "vendors", "units", "item_types",
        "item_categories", "items", "item_serial_numbers", "menu_items", "purchase_entries",
        "purchase_items", "consumption_entries", "wastage_entries", "vendor_payments"
    ]:
        op.execute(f"ALTER TABLE {table} ADD CONSTRAINT ck_{table}_status_binary CHECK (status IN (0,1))")

    # 4) Performance indexes
    op.create_index("idx_purchase_entries_purchase_date", "purchase_entries", ["purchase_date"], unique=False)
    op.create_index("idx_consumption_entries_usage_date", "consumption_entries", ["usage_date"], unique=False)
    op.create_index("idx_wastage_entries_wastage_date", "wastage_entries", ["wastage_date"], unique=False)
    op.create_index("idx_stock_ledger_txn_date", "stock_ledger", ["txn_date"], unique=False)

    op.create_index("idx_purchase_entries_vendor_id", "purchase_entries", ["vendor_id"], unique=False)
    op.create_index("idx_purchase_entries_user_id", "purchase_entries", ["user_id"], unique=False)
    op.create_index("idx_purchase_items_purchase_entry_id", "purchase_items", ["purchase_entry_id"], unique=False)
    op.create_index("idx_purchase_items_item_id", "purchase_items", ["item_id"], unique=False)
    op.create_index("idx_consumption_items_consumption_entry_id", "consumption_items", ["consumption_entry_id"], unique=False)
    op.create_index("idx_consumption_items_item_id", "consumption_items", ["item_id"], unique=False)
    op.create_index("idx_wastage_items_wastage_entry_id", "wastage_items", ["wastage_entry_id"], unique=False)
    op.create_index("idx_wastage_items_item_id", "wastage_items", ["item_id"], unique=False)
    op.create_index("idx_wastage_items_menu_item_id", "wastage_items", ["menu_item_id"], unique=False)
    op.create_index("idx_stock_ledger_item_id", "stock_ledger", ["item_id"], unique=False)

    # 5) Derived totals consistency bootstrap for existing rows
    op.execute(
        """
        UPDATE consumption_entries
        SET total_cooking_persons = COALESCE(regular_cooking_persons, 0) + COALESCE(additional_cooking_persons, 0),
            total_cleaning_persons = COALESCE(regular_cleaning_persons, 0) + COALESCE(additional_cleaning_persons, 0),
            total_serving_persons = COALESCE(regular_serving_persons, 0) + COALESCE(additional_serving_persons, 0)
        """
    )

    # 6) Token details PK normalization (canonical composite PK)
    op.execute("ALTER TABLE token_details DROP CONSTRAINT IF EXISTS token_details_pkey")
    op.execute("ALTER TABLE token_details ADD CONSTRAINT token_details_pkey PRIMARY KEY (id, created_at)")


def downgrade() -> None:
    op.execute("ALTER TABLE token_details DROP CONSTRAINT IF EXISTS token_details_pkey")
    op.execute("ALTER TABLE token_details ADD CONSTRAINT token_details_pkey PRIMARY KEY (id, created_at)")

    op.drop_index("idx_stock_ledger_item_id", table_name="stock_ledger")
    op.drop_index("idx_wastage_items_menu_item_id", table_name="wastage_items")
    op.drop_index("idx_wastage_items_item_id", table_name="wastage_items")
    op.drop_index("idx_wastage_items_wastage_entry_id", table_name="wastage_items")
    op.drop_index("idx_consumption_items_item_id", table_name="consumption_items")
    op.drop_index("idx_consumption_items_consumption_entry_id", table_name="consumption_items")
    op.drop_index("idx_purchase_items_item_id", table_name="purchase_items")
    op.drop_index("idx_purchase_items_purchase_entry_id", table_name="purchase_items")
    op.drop_index("idx_purchase_entries_user_id", table_name="purchase_entries")
    op.drop_index("idx_purchase_entries_vendor_id", table_name="purchase_entries")

    op.drop_index("idx_stock_ledger_txn_date", table_name="stock_ledger")
    op.drop_index("idx_wastage_entries_wastage_date", table_name="wastage_entries")
    op.drop_index("idx_consumption_entries_usage_date", table_name="consumption_entries")
    op.drop_index("idx_purchase_entries_purchase_date", table_name="purchase_entries")

    for table in [
        "roles", "privileges", "role_privileges", "users", "vendors", "units", "item_types",
        "item_categories", "items", "item_serial_numbers", "menu_items", "purchase_entries",
        "purchase_items", "consumption_entries", "wastage_entries", "vendor_payments"
    ]:
        op.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS ck_{table}_status_binary")

    op.execute("ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS ck_stock_ledger_current_value_non_negative")
    op.execute("ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS ck_stock_ledger_value_out_non_negative")
    op.execute("ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS ck_stock_ledger_value_in_non_negative")
    op.execute("ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS ck_stock_ledger_unit_cost_non_negative")
    op.execute("ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS ck_stock_ledger_qty_out_non_negative")
    op.execute("ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS ck_stock_ledger_qty_in_non_negative")
    op.execute("ALTER TABLE wastage_items DROP CONSTRAINT IF EXISTS ck_wastage_items_approx_amount_non_negative")
    op.execute("ALTER TABLE wastage_items DROP CONSTRAINT IF EXISTS ck_wastage_items_quantity_non_negative")
    op.execute("ALTER TABLE vendor_payments DROP CONSTRAINT IF EXISTS ck_vendor_payments_amount_non_negative")
    op.execute("ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS ck_purchase_items_line_total_non_negative")
    op.execute("ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS ck_purchase_items_price_non_negative")
    op.execute("ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS ck_purchase_items_quantity_non_negative")
    op.execute("ALTER TABLE item_prices DROP CONSTRAINT IF EXISTS ck_item_prices_price_non_negative")
    op.execute("ALTER TABLE items DROP CONSTRAINT IF EXISTS ck_items_current_stock_non_negative")
    op.execute("ALTER TABLE items DROP CONSTRAINT IF EXISTS ck_items_opening_stock_non_negative")

    op.alter_column(
        "vendors",
        "opening_balance",
        existing_type=sa.Numeric(15, 3),
        type_=sa.Text(),
        postgresql_using="opening_balance::text",
        existing_nullable=False,
    )
    op.alter_column(
        "items",
        "current_stock",
        existing_type=sa.Numeric(15, 3),
        type_=sa.String(length=50),
        postgresql_using="current_stock::text",
        existing_nullable=False,
    )
    op.alter_column(
        "items",
        "opening_stock",
        existing_type=sa.Numeric(15, 3),
        type_=sa.String(length=50),
        postgresql_using="opening_stock::text",
        existing_nullable=False,
    )

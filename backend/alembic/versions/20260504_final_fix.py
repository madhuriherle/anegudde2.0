"""initial partitioned schema

Revision ID: 20260504_initial
Revises: 
Create Date: 2026-05-04 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '20260504_initial'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # 1. ROLES
    op.create_table('roles',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('role_name', sa.String(length=50), nullable=False, unique=True),
        sa.Column('status', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True)
    )

    # 2. USERS
    op.create_table('users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('username', sa.String(length=100), nullable=False, unique=True),
        sa.Column('password', sa.String(length=255), nullable=False),
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('roles.id'), nullable=False),
        sa.Column('full_name', sa.String(length=150), nullable=False),
        sa.Column('email', sa.String(length=150), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('status', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True)
    )
    op.create_foreign_key('fk_roles_created_by', 'roles', 'users', ['created_by'], ['id'])
    op.create_foreign_key('fk_roles_updated_by', 'roles', 'users', ['updated_by'], ['id'])

    # 3. PRIVILEGES & ROLE_PRIVILEGES
    op.create_table('privileges',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('privilege_name', sa.String(length=100), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True)
    )
    op.create_table('role_privileges',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('roles.id'), nullable=False),
        sa.Column('privilege_id', sa.Integer(), sa.ForeignKey('privileges.id'), nullable=False),
        sa.Column('status', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True)
    )

    # 4. CHEFS & VENDORS
    op.create_table('chefs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('chef_name', sa.String(length=150), nullable=False),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('status', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True)
    )
    op.create_table('vendors',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('vendor_code', sa.String(length=30), nullable=False, unique=True),
        sa.Column('vendor_name', sa.String(length=150), nullable=False),
        sa.Column('contact_number', sa.String(length=20), nullable=False),
        sa.Column('alternate_contact_number', sa.String(length=20), nullable=True),
        sa.Column('email', sa.String(length=150), nullable=True),
        sa.Column('address_line1', sa.String(length=255), nullable=False),
        sa.Column('address_line2', sa.String(length=255), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('state', sa.String(length=100), nullable=True),
        sa.Column('postal_code', sa.String(length=20), nullable=True),
        sa.Column('gst_number', sa.String(length=30), nullable=True),
        sa.Column('pan_number', sa.String(length=20), nullable=True),
        sa.Column('opening_balance', sa.Numeric(15, 3), nullable=False, server_default='0'),
        sa.Column('current_balance', sa.Numeric(15, 3), nullable=False, server_default='0'),
        sa.Column('credit_limit', sa.Numeric(15, 3), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True)
    )

    # 5. UNITS & CATEGORIES
    op.create_table('units',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('unit_name', sa.String(length=50), nullable=False),
        sa.Column('unit_code', sa.String(length=20), nullable=False),
        sa.Column('status', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True)
    )
    op.create_table('item_categories',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('category_name', sa.String(length=100), nullable=False),
        sa.Column('status', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True)
    )

    # 6. ITEMS
    op.create_table('items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('item_name', sa.String(length=150), nullable=False, unique=True),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('item_categories.id'), nullable=False),
        sa.Column('unit_id', sa.Integer(), sa.ForeignKey('units.id'), nullable=False),
        sa.Column('opening_stock', sa.Numeric(15, 3), nullable=False, server_default='0'),
        sa.Column('current_stock', sa.Numeric(15, 3), nullable=False, server_default='0'),
        sa.Column('default_price', sa.Numeric(15, 3), nullable=True),
        sa.Column('min_stock_level', sa.Numeric(15, 3), nullable=True),
        sa.Column('max_stock_level', sa.Numeric(15, 3), nullable=True),
        sa.Column('status', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True)
    )

    # 7. PARTITIONED TABLES
    partitioned_sql = {
        "stock_ledger": "id SERIAL, txn_date DATE NOT NULL, item_id INTEGER REFERENCES items(id), txn_type SMALLINT, ref_table VARCHAR(100), ref_id INTEGER, qty_in NUMERIC(15,3), qty_out NUMERIC(15,3), unit_cost NUMERIC(15,3), value_in NUMERIC(15,3), value_out NUMERIC(15,3), balance NUMERIC(15,3), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_by INTEGER, updated_by INTEGER",
        "purchase_entries": "id SERIAL, purchase_date DATE NOT NULL, vendor_id INTEGER REFERENCES vendors(id), bill_no VARCHAR(50), total_amount NUMERIC(15,3), user_id INTEGER REFERENCES users(id), status INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_by INTEGER, updated_by INTEGER",
        "purchase_items": "id SERIAL, purchase_entry_id INTEGER, purchase_date DATE NOT NULL, item_id INTEGER REFERENCES items(id), quantity NUMERIC(15,3), price NUMERIC(15,3), line_total NUMERIC(15,3), status INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_by INTEGER, updated_by INTEGER",
        "consumption_entries": "id SERIAL, usage_date DATE NOT NULL, people_served INTEGER, chef_id INTEGER REFERENCES chefs(id), user_id INTEGER REFERENCES users(id), status INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_by INTEGER, updated_by INTEGER",
        "consumption_items": "id SERIAL, consumption_entry_id INTEGER, usage_date DATE NOT NULL, item_id INTEGER REFERENCES items(id), quantity_used NUMERIC(15,3), unit_cost_at_time NUMERIC(15,3), line_total NUMERIC(15,3), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_by INTEGER, updated_by INTEGER",
        "wastage_entries": "id SERIAL, wastage_date DATE NOT NULL, reason TEXT, user_id INTEGER REFERENCES users(id), status INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_by INTEGER, updated_by INTEGER",
        "wastage_items": "id SERIAL, wastage_entry_id INTEGER, wastage_date DATE NOT NULL, item_id INTEGER REFERENCES items(id), quantity NUMERIC(15,3), unit_cost_at_time NUMERIC(15,3), line_total NUMERIC(15,3), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_by INTEGER, updated_by INTEGER",
        "stock_adjustments": "id SERIAL, adjustment_date DATE NOT NULL, item_id INTEGER REFERENCES items(id), adjusted_qty NUMERIC(15,3), reason VARCHAR(255), user_id INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_by INTEGER",
        "vendor_payments": "id SERIAL, payment_date DATE NOT NULL, vendor_id INTEGER REFERENCES vendors(id), amount NUMERIC(15,3), payment_mode VARCHAR(30), reference_no VARCHAR(100), remarks TEXT, user_id INTEGER REFERENCES users(id), status INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, created_by INTEGER, updated_by INTEGER",
        "notifications": "id SERIAL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, title VARCHAR(150), message TEXT, notification_type VARCHAR(50), is_read INTEGER DEFAULT 0, link VARCHAR(255)",
        "login_history": "id SERIAL, logged_in_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, user_id INTEGER REFERENCES users(id), login_identifier VARCHAR(150), login_status VARCHAR(20), failure_reason VARCHAR(255), ip_address VARCHAR(45), device_info VARCHAR(255), user_agent TEXT, session_token TEXT, logged_out_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "daily_stock_summary": "id SERIAL, summary_date DATE NOT NULL, item_id INTEGER REFERENCES items(id), opening_stock NUMERIC(15,3), purchased_qty NUMERIC(15,3), consumed_qty NUMERIC(15,3), wastage_qty NUMERIC(15,3), adjustment_qty NUMERIC(15,3), closing_stock NUMERIC(15,3), avg_purchase_price NUMERIC(15,2), stock_value NUMERIC(15,2), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "monthly_stock_summary": "id SERIAL, summary_month DATE NOT NULL, item_id INTEGER REFERENCES items(id), opening_stock NUMERIC(15,3), total_purchased_qty NUMERIC(15,3), total_consumed_qty NUMERIC(15,3), total_wastage_qty NUMERIC(15,3), total_adjustment_qty NUMERIC(15,3), closing_stock NUMERIC(15,3), avg_purchase_price NUMERIC(15,2), closing_stock_value NUMERIC(15,2), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    }

    date_cols = {
        "stock_ledger": "txn_date", "purchase_entries": "purchase_date", "purchase_items": "purchase_date",
        "consumption_entries": "usage_date", "consumption_items": "usage_date", "wastage_entries": "wastage_date",
        "wastage_items": "wastage_date", "stock_adjustments": "adjustment_date", "vendor_payments": "payment_date",
        "notifications": "created_at", "login_history": "logged_in_at", "daily_stock_summary": "summary_date",
        "monthly_stock_summary": "summary_month"
    }

    for table, cols in partitioned_sql.items():
        date_col = date_cols[table]
        op.execute(f"CREATE TABLE {table} ({cols}, PRIMARY KEY (id, {date_col})) PARTITION BY RANGE ({date_col});")

    # Composite Foreign Keys for children
    op.create_foreign_key('fk_purchase_items_entry', 'purchase_items', 'purchase_entries', ['purchase_entry_id', 'purchase_date'], ['id', 'purchase_date'])
    op.create_foreign_key('fk_consumption_items_entry', 'consumption_items', 'consumption_entries', ['consumption_entry_id', 'usage_date'], ['id', 'usage_date'])
    op.create_foreign_key('fk_wastage_items_entry', 'wastage_items', 'wastage_entries', ['wastage_entry_id', 'wastage_date'], ['id', 'wastage_date'])

    # 8. YEARLY PARTITIONS (2024-2030)
    for year in range(2024, 2031):
        start = f"{year}-01-01"
        end = f"{year+1}-01-01"
        for table in date_cols.keys():
            op.execute(f"CREATE TABLE IF NOT EXISTS {table}_{year} PARTITION OF {table} FOR VALUES FROM ('{start}') TO ('{end}');")

def downgrade():
    tables = ["stock_ledger", "purchase_entries", "purchase_items", "consumption_entries", "consumption_items", "wastage_entries", "wastage_items", "stock_adjustments", "vendor_payments", "notifications", "login_history", "daily_stock_summary", "monthly_stock_summary"]
    for table in tables: op.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")
    op.drop_table('items')
    op.drop_table('item_categories')
    op.drop_table('units')
    op.drop_table('vendors')
    op.drop_table('chefs')
    op.drop_table('role_privileges')
    op.drop_table('privileges')
    op.drop_table('users')
    op.drop_table('roles')

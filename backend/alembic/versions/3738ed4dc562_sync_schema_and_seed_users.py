"""sync_schema_and_seed_users

Revision ID: 3738ed4dc562
Revises: a6c1f2d3e4b5
Create Date: 2026-06-01 00:10:02.293942

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '3738ed4dc562'
down_revision: Union[str, Sequence[str], None] = 'a6c1f2d3e4b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema and seed data."""
    # Ensure missing columns exist
    op.add_column('users', sa.Column('password_ref', sa.Text(), nullable=True))

    # ### Commands for missing indexes and foreign keys ###
    op.create_index(op.f('ix_activity_logs_created_by'), 'activity_logs', ['created_by'], unique=False)
    op.create_index(op.f('ix_activity_logs_updated_by'), 'activity_logs', ['updated_by'], unique=False)
    op.create_index(op.f('ix_consumption_entries_created_by'), 'consumption_entries', ['created_by'], unique=False)
    op.create_index(op.f('ix_consumption_entries_updated_by'), 'consumption_entries', ['updated_by'], unique=False)
    op.create_index(op.f('ix_consumption_items_created_by'), 'consumption_items', ['created_by'], unique=False)
    op.create_index(op.f('ix_consumption_items_updated_by'), 'consumption_items', ['updated_by'], unique=False)
    op.create_index(op.f('ix_daily_stock_summary_created_by'), 'daily_stock_summary', ['created_by'], unique=False)
    op.create_index(op.f('ix_daily_stock_summary_updated_by'), 'daily_stock_summary', ['updated_by'], unique=False)
    op.create_index(op.f('ix_devotees_created_by'), 'devotees', ['created_by'], unique=False)
    op.create_index(op.f('ix_devotees_updated_by'), 'devotees', ['updated_by'], unique=False)
    op.create_foreign_key(None, 'devotees', 'users', ['created_by'], ['id'])
    op.create_foreign_key(None, 'devotees', 'users', ['updated_by'], ['id'])
    op.create_index(op.f('ix_donation_entries_created_by'), 'donation_entries', ['created_by'], unique=False)
    op.create_index(op.f('ix_donation_entries_updated_by'), 'donation_entries', ['updated_by'], unique=False)
    op.create_index(op.f('ix_donation_items_created_by'), 'donation_items', ['created_by'], unique=False)
    op.create_index(op.f('ix_donation_items_updated_by'), 'donation_items', ['updated_by'], unique=False)
    op.create_index(op.f('ix_donation_types_created_by'), 'donation_types', ['created_by'], unique=False)
    op.create_index(op.f('ix_donation_types_updated_by'), 'donation_types', ['updated_by'], unique=False)
    op.create_index(op.f('ix_financial_years_created_by'), 'financial_years', ['created_by'], unique=False)
    op.create_index(op.f('ix_financial_years_updated_by'), 'financial_years', ['updated_by'], unique=False)
    op.create_foreign_key(None, 'financial_years', 'users', ['created_by'], ['id'])
    op.create_index(op.f('ix_item_categories_created_by'), 'item_categories', ['created_by'], unique=False)
    op.create_index(op.f('ix_item_categories_updated_by'), 'item_categories', ['updated_by'], unique=False)
    op.create_index(op.f('ix_item_prices_created_by'), 'item_prices', ['created_by'], unique=False)
    op.create_index(op.f('ix_item_prices_updated_by'), 'item_prices', ['updated_by'], unique=False)
    op.create_index(op.f('ix_item_serial_numbers_created_by'), 'item_serial_numbers', ['created_by'], unique=False)
    op.create_index(op.f('ix_item_serial_numbers_updated_by'), 'item_serial_numbers', ['updated_by'], unique=False)
    op.create_index(op.f('ix_item_types_created_by'), 'item_types', ['created_by'], unique=False)
    op.create_index(op.f('ix_item_types_updated_by'), 'item_types', ['updated_by'], unique=False)
    op.create_index(op.f('ix_items_created_by'), 'items', ['created_by'], unique=False)
    op.create_index(op.f('ix_items_updated_by'), 'items', ['updated_by'], unique=False)
    op.create_index(op.f('ix_login_history_created_by'), 'login_history', ['created_by'], unique=False)
    op.create_index(op.f('ix_login_history_updated_by'), 'login_history', ['updated_by'], unique=False)
    op.create_index(op.f('ix_menu_items_created_by'), 'menu_items', ['created_by'], unique=False)
    op.create_index(op.f('ix_menu_items_updated_by'), 'menu_items', ['updated_by'], unique=False)
    op.create_index(op.f('ix_monthly_stock_summary_created_by'), 'monthly_stock_summary', ['created_by'], unique=False)
    op.create_index(op.f('ix_monthly_stock_summary_updated_by'), 'monthly_stock_summary', ['updated_by'], unique=False)
    op.create_index(op.f('ix_privileges_created_by'), 'privileges', ['created_by'], unique=False)
    op.create_index(op.f('ix_privileges_updated_by'), 'privileges', ['updated_by'], unique=False)
    op.create_foreign_key(None, 'privileges', 'users', ['created_by'], ['id'])
    op.create_foreign_key(None, 'privileges', 'users', ['updated_by'], ['id'])
    op.create_index(op.f('ix_purchase_bills_created_by'), 'purchase_bills', ['created_by'], unique=False)
    op.create_index(op.f('ix_purchase_bills_updated_by'), 'purchase_bills', ['updated_by'], unique=False)
    op.create_index(op.f('ix_purchase_entries_created_by'), 'purchase_entries', ['created_by'], unique=False)
    op.create_index(op.f('ix_purchase_entries_updated_by'), 'purchase_entries', ['updated_by'], unique=False)
    op.create_index(op.f('ix_purchase_items_created_by'), 'purchase_items', ['created_by'], unique=False)
    op.create_index(op.f('ix_purchase_items_updated_by'), 'purchase_items', ['updated_by'], unique=False)
    op.create_index(op.f('ix_purchase_return_entries_created_by'), 'purchase_return_entries', ['created_by'], unique=False)
    op.create_index(op.f('ix_purchase_return_entries_updated_by'), 'purchase_return_entries', ['updated_by'], unique=False)
    op.create_index(op.f('ix_purchase_return_items_created_by'), 'purchase_return_items', ['created_by'], unique=False)
    op.create_index(op.f('ix_purchase_return_items_updated_by'), 'purchase_return_items', ['updated_by'], unique=False)
    op.create_index(op.f('ix_receipt_sequences_created_by'), 'receipt_sequences', ['created_by'], unique=False)
    op.create_index(op.f('ix_receipt_sequences_updated_by'), 'receipt_sequences', ['updated_by'], unique=False)
    op.create_index(op.f('ix_role_privileges_created_by'), 'role_privileges', ['created_by'], unique=False)
    op.create_index(op.f('ix_role_privileges_updated_by'), 'role_privileges', ['updated_by'], unique=False)
    op.create_foreign_key(None, 'role_privileges', 'users', ['updated_by'], ['id'])
    op.create_foreign_key(None, 'role_privileges', 'users', ['created_by'], ['id'])
    op.create_index(op.f('ix_roles_created_by'), 'roles', ['created_by'], unique=False)
    op.create_index(op.f('ix_roles_updated_by'), 'roles', ['updated_by'], unique=False)
    op.create_foreign_key(None, 'roles', 'users', ['updated_by'], ['id'])
    op.create_foreign_key(None, 'roles', 'users', ['created_by'], ['id'])
    op.create_index(op.f('ix_stock_adjustments_created_by'), 'stock_adjustments', ['created_by'], unique=False)
    op.create_index(op.f('ix_stock_adjustments_updated_by'), 'stock_adjustments', ['updated_by'], unique=False)
    op.create_index(op.f('ix_stock_ledger_created_by'), 'stock_ledger', ['created_by'], unique=False)
    op.create_index(op.f('ix_stock_ledger_updated_by'), 'stock_ledger', ['updated_by'], unique=False)
    op.create_index(op.f('ix_system_settings_created_by'), 'system_settings', ['created_by'], unique=False)
    op.create_index(op.f('ix_system_settings_current_financial_year_id'), 'system_settings', ['current_financial_year_id'], unique=False)
    op.create_index(op.f('ix_system_settings_updated_by'), 'system_settings', ['updated_by'], unique=False)
    op.create_index(op.f('ix_token_details_created_by'), 'token_details', ['created_by'], unique=False)
    op.create_index(op.f('ix_token_details_updated_by'), 'token_details', ['updated_by'], unique=False)
    op.create_index(op.f('ix_token_generations_created_by'), 'token_generations', ['created_by'], unique=False)
    op.create_index(op.f('ix_token_generations_updated_by'), 'token_generations', ['updated_by'], unique=False)
    op.create_index(op.f('ix_units_created_by'), 'units', ['created_by'], unique=False)
    op.create_index(op.f('ix_units_updated_by'), 'units', ['updated_by'], unique=False)
    op.create_index(op.f('ix_users_created_by'), 'users', ['created_by'], unique=False)
    op.create_index(op.f('ix_users_updated_by'), 'users', ['updated_by'], unique=False)
    op.create_index(op.f('ix_vendors_created_by'), 'vendors', ['created_by'], unique=False)
    op.create_index(op.f('ix_vendors_updated_by'), 'vendors', ['updated_by'], unique=False)
    op.create_index(op.f('ix_wastage_entries_created_by'), 'wastage_entries', ['created_by'], unique=False)
    op.create_index(op.f('ix_wastage_entries_updated_by'), 'wastage_entries', ['updated_by'], unique=False)
    op.create_index(op.f('ix_wastage_items_created_by'), 'wastage_items', ['created_by'], unique=False)
    op.create_index(op.f('ix_wastage_items_updated_by'), 'wastage_items', ['updated_by'], unique=False)

    # Seed/Update Roles
    op.execute("""
        INSERT INTO roles (role_name, rank_level, is_all_access, status, created_at, updated_at)
        VALUES 
            ('Super Admin', 1, TRUE, 1, NOW(), NOW()),
            ('Temple Trustee', 2, FALSE, 1, NOW(), NOW()),
            ('Admin', 3, FALSE, 1, NOW(), NOW()),
            ('Manager', 4, FALSE, 1, NOW(), NOW()),
            ('Supervisor', 5, FALSE, 1, NOW(), NOW())
        ON CONFLICT (role_name) DO UPDATE 
        SET rank_level = EXCLUDED.rank_level, is_all_access = EXCLUDED.is_all_access, status = EXCLUDED.status, updated_at = NOW();
    """)

    # Seed Users
    # Password: Temple@123
    # Bcrypt Hash: $2b$12$K8h6aXv9S6VFNgNf65hdieWRbu/Q78Qea8a98OjEmHQUbYvOReLk.
    # Encrypted Ref: gAAAAABqHIDOL7nQG6trxj5t-6t0SGgsIXkbmVWnbUf6BBc0H-rt3O9poaoYPHOoPppL9aPNa8ukRyZ_BECTT1bVgZ1jcsAv-w==
    
    password_hash = '$2b$12$K8h6aXv9S6VFNgNf65hdieWRbu/Q78Qea8a98OjEmHQUbYvOReLk.'
    password_ref = 'gAAAAABqHIDOL7nQG6trxj5t-6t0SGgsIXkbmVWnbUf6BBc0H-rt3O9poaoYPHOoPppL9aPNa8ukRyZ_BECTT1bVgZ1jcsAv-w=='

    op.execute(f"""
        INSERT INTO users (username, full_name, user_code, password, password_ref, role_id, status, created_at, updated_at)
        SELECT 'dpsadmin', 'Super Admin', 'SADM', '{password_hash}', '{password_ref}', id, 1, NOW(), NOW()
        FROM roles WHERE role_name = 'Super Admin'
        ON CONFLICT (username) DO UPDATE SET
            user_code = EXCLUDED.user_code,
            password = EXCLUDED.password,
            password_ref = EXCLUDED.password_ref,
            role_id = EXCLUDED.role_id,
            updated_at = NOW();
        
        INSERT INTO users (username, full_name, user_code, password, password_ref, role_id, status, created_at, updated_at)
        SELECT 'agtadmin', 'Admin', 'ADM', '{password_hash}', '{password_ref}', id, 1, NOW(), NOW()
        FROM roles WHERE role_name = 'Admin'
        ON CONFLICT (username) DO UPDATE SET
            user_code = EXCLUDED.user_code,
            password = EXCLUDED.password,
            password_ref = EXCLUDED.password_ref,
            role_id = EXCLUDED.role_id,
            updated_at = NOW();
        
        INSERT INTO users (username, full_name, user_code, password, password_ref, role_id, status, created_at, updated_at)
        SELECT 'trustee', 'Temple Trustee', 'TT', '{password_hash}', '{password_ref}', id, 1, NOW(), NOW()
        FROM roles WHERE role_name = 'Temple Trustee'
        ON CONFLICT (username) DO UPDATE SET
            user_code = EXCLUDED.user_code,
            password = EXCLUDED.password,
            password_ref = EXCLUDED.password_ref,
            role_id = EXCLUDED.role_id,
            updated_at = NOW();
        
        INSERT INTO users (username, full_name, user_code, password, password_ref, role_id, status, created_at, updated_at)
        SELECT 'manager', 'Manager', 'CM', '{password_hash}', '{password_ref}', id, 1, NOW(), NOW()
        FROM roles WHERE role_name = 'Manager'
        ON CONFLICT (username) DO UPDATE SET
            user_code = EXCLUDED.user_code,
            password = EXCLUDED.password,
            password_ref = EXCLUDED.password_ref,
            role_id = EXCLUDED.role_id,
            updated_at = NOW();
        
        INSERT INTO users (username, full_name, user_code, password, password_ref, role_id, status, created_at, updated_at)
        SELECT 'supervisor', 'Supervisor', 'CS', '{password_hash}', '{password_ref}', id, 1, NOW(), NOW()
        FROM roles WHERE role_name = 'Supervisor'
        ON CONFLICT (username) DO UPDATE SET
            user_code = EXCLUDED.user_code,
            password = EXCLUDED.password,
            password_ref = EXCLUDED.password_ref,
            role_id = EXCLUDED.role_id,
            updated_at = NOW();
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Delete seeded users
    op.execute("DELETE FROM users WHERE username IN ('dpsadmin', 'agtadmin', 'trustee', 'manager', 'supervisor');")
    
    # Drop indexes and foreign keys
    op.drop_index(op.f('ix_wastage_items_updated_by'), table_name='wastage_items')
    op.drop_index(op.f('ix_wastage_items_created_by'), table_name='wastage_items')
    op.drop_index(op.f('ix_wastage_entries_updated_by'), table_name='wastage_entries')
    op.drop_index(op.f('ix_wastage_entries_created_by'), table_name='wastage_entries')
    op.drop_index(op.f('ix_vendors_updated_by'), table_name='vendors')
    op.drop_index(op.f('ix_vendors_created_by'), table_name='vendors')
    op.drop_index(op.f('ix_users_updated_by'), table_name='users')
    op.drop_index(op.f('ix_users_created_by'), table_name='users')
    op.drop_index(op.f('ix_units_updated_by'), table_name='units')
    op.drop_index(op.f('ix_units_created_by'), table_name='units')
    op.drop_index(op.f('ix_token_generations_updated_by'), table_name='token_generations')
    op.drop_index(op.f('ix_token_generations_created_by'), table_name='token_generations')
    op.drop_index(op.f('ix_token_details_updated_by'), table_name='token_details')
    op.drop_index(op.f('ix_token_details_created_by'), table_name='token_details')
    op.drop_index(op.f('ix_system_settings_updated_by'), table_name='system_settings')
    op.drop_index(op.f('ix_system_settings_current_financial_year_id'), table_name='system_settings')
    op.drop_index(op.f('ix_system_settings_created_by'), table_name='system_settings')
    op.drop_index(op.f('ix_stock_ledger_updated_by'), table_name='stock_ledger')
    op.drop_index(op.f('ix_stock_ledger_created_by'), table_name='stock_ledger')
    op.drop_index(op.f('ix_stock_adjustments_updated_by'), table_name='stock_adjustments')
    op.drop_index(op.f('ix_stock_adjustments_created_by'), table_name='stock_adjustments')
    op.drop_constraint(None, 'roles', type_='foreignkey')
    op.drop_constraint(None, 'roles', type_='foreignkey')
    op.drop_index(op.f('ix_roles_updated_by'), table_name='roles')
    op.drop_index(op.f('ix_roles_created_by'), table_name='roles')
    op.drop_constraint(None, 'role_privileges', type_='foreignkey')
    op.drop_constraint(None, 'role_privileges', type_='foreignkey')
    op.drop_index(op.f('ix_role_privileges_updated_by'), table_name='role_privileges')
    op.drop_index(op.f('ix_role_privileges_created_by'), table_name='role_privileges')
    op.drop_index(op.f('ix_receipt_sequences_updated_by'), table_name='receipt_sequences')
    op.drop_index(op.f('ix_receipt_sequences_created_by'), table_name='receipt_sequences')
    op.drop_index(op.f('ix_purchase_return_items_updated_by'), table_name='purchase_return_items')
    op.drop_index(op.f('ix_purchase_return_items_created_by'), table_name='purchase_return_items')
    op.drop_index(op.f('ix_purchase_return_entries_updated_by'), table_name='purchase_return_entries')
    op.drop_index(op.f('ix_purchase_return_entries_created_by'), table_name='purchase_return_entries')
    op.drop_index(op.f('ix_purchase_items_updated_by'), table_name='purchase_items')
    op.drop_index(op.f('ix_purchase_items_created_by'), table_name='purchase_items')
    op.drop_index(op.f('ix_purchase_entries_updated_by'), table_name='purchase_entries')
    op.drop_index(op.f('ix_purchase_entries_created_by'), table_name='purchase_entries')
    op.drop_index(op.f('ix_purchase_bills_updated_by'), table_name='purchase_bills')
    op.drop_index(op.f('ix_purchase_bills_created_by'), table_name='purchase_bills')
    op.drop_constraint(None, 'privileges', type_='foreignkey')
    op.drop_constraint(None, 'privileges', type_='foreignkey')
    op.drop_index(op.f('ix_privileges_updated_by'), table_name='privileges')
    op.drop_index(op.f('ix_privileges_created_by'), table_name='privileges')
    op.drop_index(op.f('ix_monthly_stock_summary_updated_by'), table_name='monthly_stock_summary')
    op.drop_index(op.f('ix_monthly_stock_summary_created_by'), table_name='monthly_stock_summary')
    op.drop_index(op.f('ix_menu_items_updated_by'), table_name='menu_items')
    op.drop_index(op.f('ix_menu_items_created_by'), table_name='menu_items')
    op.drop_index(op.f('ix_login_history_updated_by'), table_name='login_history')
    op.drop_index(op.f('ix_login_history_created_by'), table_name='login_history')
    op.drop_index(op.f('ix_items_updated_by'), table_name='items')
    op.drop_index(op.f('ix_items_created_by'), table_name='items')
    op.drop_index(op.f('ix_item_types_updated_by'), table_name='item_types')
    op.drop_index(op.f('ix_item_types_created_by'), table_name='item_types')
    op.drop_index(op.f('ix_item_serial_numbers_updated_by'), table_name='item_serial_numbers')
    op.drop_index(op.f('ix_item_serial_numbers_created_by'), table_name='item_serial_numbers')
    op.drop_index(op.f('ix_item_prices_updated_by'), table_name='item_prices')
    op.drop_index(op.f('ix_item_prices_created_by'), table_name='item_prices')
    op.drop_index(op.f('ix_item_categories_updated_by'), table_name='item_categories')
    op.drop_index(op.f('ix_item_categories_created_by'), table_name='item_categories')
    op.drop_constraint(None, 'financial_years', type_='foreignkey')
    op.drop_index(op.f('ix_financial_years_updated_by'), table_name='financial_years')
    op.drop_index(op.f('ix_financial_years_created_by'), table_name='financial_years')
    op.drop_index(op.f('ix_donation_types_updated_by'), table_name='donation_types')
    op.drop_index(op.f('ix_donation_types_created_by'), table_name='donation_types')
    op.drop_index(op.f('ix_donation_items_updated_by'), table_name='donation_items')
    op.drop_index(op.f('ix_donation_items_created_by'), table_name='donation_items')
    op.drop_index(op.f('ix_donation_entries_updated_by'), table_name='donation_entries')
    op.drop_index(op.f('ix_donation_entries_created_by'), table_name='donation_entries')
    op.drop_constraint(None, 'devotees', type_='foreignkey')
    op.drop_constraint(None, 'devotees', type_='foreignkey')
    op.drop_index(op.f('ix_devotees_updated_by'), table_name='devotees')
    op.drop_index(op.f('ix_devotees_created_by'), table_name='devotees')
    op.drop_index(op.f('ix_daily_stock_summary_updated_by'), table_name='daily_stock_summary')
    op.drop_index(op.f('ix_daily_stock_summary_created_by'), table_name='daily_stock_summary')
    op.drop_index(op.f('ix_consumption_items_updated_by'), table_name='consumption_items')
    op.drop_index(op.f('ix_consumption_items_created_by'), table_name='consumption_items')
    op.drop_index(op.f('ix_consumption_entries_updated_by'), table_name='consumption_entries')
    op.drop_index(op.f('ix_consumption_entries_created_by'), table_name='consumption_entries')
    op.drop_index(op.f('ix_activity_logs_updated_by'), table_name='activity_logs')
    op.drop_index(op.f('ix_activity_logs_created_by'), table_name='activity_logs')

import os
import sys

env_path = os.path.join(os.path.dirname(__file__), "backend", ".env")
database_url = None
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                database_url = line.split("=", 1)[1]
                break

if not database_url:
    database_url = os.environ.get("DATABASE_URL")

if not database_url:
    print("ERROR: Could not find DATABASE_URL")
    sys.exit(1)

from sqlalchemy import create_engine, text, MetaData

engine = create_engine(database_url)

# First find the users
with engine.connect() as conn:
    print("=" * 80)
    print("USERS WITH 'Rajeshwari' OR 'D-Apps' IN USERNAME OR FULL_NAME")
    print("=" * 80)
    users = conn.execute(
        text("SELECT id, username, full_name, user_code, status FROM users "
             "WHERE username ILIKE '%rajeshwari%' OR full_name ILIKE '%rajeshwari%' "
             "OR username ILIKE '%d-apps%' OR full_name ILIKE '%d-apps%' "
             "OR username ILIKE '%dapps%' OR full_name ILIKE '%dapps%'")
    ).fetchall()
    
    if not users:
        print("No matching users found. Listing ALL users instead:")
        users = conn.execute(
            text("SELECT id, username, full_name, user_code, status, is_deleted FROM users ORDER BY id")
        ).fetchall()
    
    for u in users:
        print(f"  ID={u[0]}, username='{u[1]}', full_name='{u[2]}', code='{u[3]}', status={u[4] if len(u) > 4 else '?'}, deleted={u[5] if len(u) > 5 else '?'}")

    print()
    
    # For each matching user, count records in all tables with created_by/updated_by
    tables_with_user_fks = [
        "financial_years", "system_settings", "printer_configs", "receipt_sequences",
        "roles", "modules", "privileges", "users", "role_privileges",
        "vendors", "units", "item_types", "donation_types", "donation_amount_masters",
        "menu_items", "item_categories", "items", "item_serial_numbers", "item_prices",
        "purchase_entries", "purchase_bills", "purchase_items",
        "consumption_entries", "consumption_items",
        "wastage_entries", "wastage_items",
        "stock_adjustments", "stock_ledger",
        "devotees", "donation_entries", "donation_items",
        "login_history", "activity_logs", "daily_stock_summary", "monthly_stock_summary",
        "token_generations", "token_details",
        "purchase_return_entries", "purchase_return_items",
    ]

    # Also check user_id, deleted_by_id columns
    extra_fk_tables = {
        "purchase_entries": ["user_id", "deleted_by_id"],
        "consumption_entries": ["user_id", "deleted_by_id"],
        "wastage_entries": ["user_id", "deleted_by_id"],
        "stock_adjustments": ["user_id"],
        "donation_entries": ["user_id", "deleted_by_id"],
        "purchase_return_entries": ["user_id", "deleted_by_id"],
        "users": ["deleted_by_id"],
        "roles": ["deleted_by_id"],
        "vendors": ["deleted_by_id"],
        "units": ["deleted_by_id"],
        "donation_types": ["deleted_by_id"],
        "donation_amount_masters": ["deleted_by_id"],
        "menu_items": ["deleted_by_id"],
        "item_categories": ["deleted_by_id"],
        "items": ["deleted_by_id"],
        "devotees": ["deleted_by_id"],
    }

    for user in users:
        uid = user[0]
        uname = user[1]
        print(f"\n{'=' * 80}")
        print(f"RECORDS FOR USER: {uname} (ID={uid})")
        print(f"{'=' * 80}")
        
        total_count = 0
        
        for table in tables_with_user_fks:
            cols = ["created_by", "updated_by"]
            extra_cols = extra_fk_tables.get(table, [])
            all_cols = cols + extra_cols
            
            for col in all_cols:
                try:
                    result = conn.execute(
                        text(f"SELECT COUNT(*) FROM {table} WHERE {col} = :uid"),
                        {"uid": uid}
                    ).scalar()
                    if result and result > 0:
                        print(f"  {table}.{col}: {result} record(s)")
                        total_count += result
                except Exception:
                    pass  # column might not exist
        
        # Also count entries where this user is referenced as user_id in specific tables
        # Show a few sample records for key transaction tables
        sample_tables = ["purchase_entries", "consumption_entries", "wastage_entries", 
                         "donation_entries", "stock_adjustments", "token_generations",
                         "activity_logs"]
        for table in sample_tables:
            try:
                rows = conn.execute(
                    text(f"SELECT id, created_at FROM {table} WHERE created_by = :uid ORDER BY id DESC LIMIT 3"),
                    {"uid": uid}
                ).fetchall()
                if rows:
                    print(f"  Sample {table}: IDs {[r[0] for r in rows]}")
            except Exception:
                pass
        
        if total_count == 0:
            print("  (No records found)")
        else:
            print(f"\n  TOTAL: {total_count} records across all tables")

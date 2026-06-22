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

from sqlalchemy import create_engine, text

engine = create_engine(database_url)

# All tables and their user FK columns
# (table, column) pairs from the actual model definitions
USER_FK_COLUMNS = {
    "financial_years": ["created_by", "updated_by"],
    "system_settings": ["created_by", "updated_by"],
    "printer_configs": ["created_by", "updated_by"],
    "receipt_sequences": ["created_by", "updated_by"],
    "roles": ["created_by", "updated_by", "deleted_by_id"],
    "modules": ["created_by", "updated_by"],
    "privileges": ["created_by", "updated_by"],
    "users": ["created_by", "updated_by", "deleted_by_id"],
    "role_privileges": ["created_by", "updated_by"],
    "vendors": ["created_by", "updated_by", "deleted_by_id"],
    "units": ["created_by", "updated_by", "deleted_by_id"],
    "item_types": ["created_by", "updated_by"],
    "donation_types": ["created_by", "updated_by", "deleted_by_id"],
    "donation_amount_masters": ["created_by", "updated_by", "deleted_by_id"],
    "menu_items": ["created_by", "updated_by", "deleted_by_id"],
    "item_categories": ["created_by", "updated_by", "deleted_by_id"],
    "items": ["created_by", "updated_by", "deleted_by_id"],
    "item_serial_numbers": ["created_by", "updated_by"],
    "item_prices": ["created_by", "updated_by"],
    "purchase_entries": ["user_id", "created_by", "updated_by", "deleted_by_id"],
    "purchase_bills": ["created_by", "updated_by"],
    "purchase_items": ["created_by", "updated_by"],
    "consumption_entries": ["user_id", "created_by", "updated_by", "deleted_by_id"],
    "consumption_items": ["created_by", "updated_by"],
    "wastage_entries": ["user_id", "created_by", "updated_by", "deleted_by_id"],
    "wastage_items": ["created_by", "updated_by"],
    "stock_adjustments": ["user_id", "created_by", "updated_by"],
    "stock_ledger": ["created_by", "updated_by"],
    "devotees": ["created_by", "updated_by", "deleted_by_id"],
    "donation_entries": ["user_id", "created_by", "updated_by", "deleted_by_id"],
    "donation_items": ["created_by", "updated_by"],
    "login_history": ["user_id", "created_by", "updated_by"],
    "activity_logs": ["user_id", "created_by", "updated_by"],
    "daily_stock_summary": ["created_by", "updated_by"],
    "monthly_stock_summary": ["created_by", "updated_by"],
    "token_generations": ["created_by", "updated_by"],
    "token_details": ["created_by", "updated_by"],
    "purchase_return_entries": ["user_id", "created_by", "updated_by", "deleted_by_id"],
    "purchase_return_items": ["created_by", "updated_by"],
}

with engine.connect() as conn:
    trans = conn.begin()
    try:
        # Find target users
        target_users = conn.execute(
            text("SELECT id, username, full_name FROM users "
                 "WHERE (username ILIKE '%rajeshwari%' OR full_name ILIKE '%rajeshwari%' "
                 "OR username ILIKE '%d-apps%' OR full_name ILIKE '%d-apps%' "
                 "OR username ILIKE '%dapps%' OR full_name ILIKE '%dapps%')")
        ).fetchall()

        if not target_users:
            print("No matching target users found.")
            # Show all users for debugging
            all_users = conn.execute(
                text("SELECT id, username, full_name, is_deleted FROM users ORDER BY id")
            ).fetchall()
            for u in all_users:
                print(f"  ID={u[0]}, username='{u[1]}', full_name='{u[2]}', deleted={u[3]}")
            sys.exit(0)

        target_ids = [u[0] for u in target_users]
        print(f"Found {len(target_users)} target user(s):")
        for u in target_users:
            print(f"  ID={u[0]}, username='{u[1]}', full_name='{u[2]}'")

        # Find Super Admin user (first active user with Super Admin role, or ID=1)
        super_admin = conn.execute(
            text("SELECT u.id, u.username, u.full_name FROM users u "
                 "JOIN roles r ON u.role_id = r.id "
                 "WHERE r.role_name = 'Super Admin' AND u.is_deleted = FALSE "
                 "LIMIT 1")
        ).fetchone()

        if not super_admin:
            # Fallback: user ID 1
            super_admin = conn.execute(
                text("SELECT id, username, full_name FROM users WHERE id = 1 AND is_deleted = FALSE")
            ).fetchone()

        if not super_admin:
            print("ERROR: Could not find Super Admin user")
            sys.exit(1)

        super_admin_id = super_admin[0]
        print(f"\nSuper Admin user: ID={super_admin[0]}, username='{super_admin[1]}', full_name='{super_admin[2]}'")

        # Reassign records: for each target user, for each table+column, update FK to super_admin_id
        total_updated = 0
        updates_by_table = {}

        for uid in target_ids:
            for table, columns in USER_FK_COLUMNS.items():
                for col in columns:
                    # Check if column exists in table
                    try:
                        check = conn.execute(
                            text(f"SELECT COUNT(*) FROM information_schema.columns "
                                 f"WHERE table_name = :t AND column_name = :c"),
                            {"t": table, "c": col}
                        ).scalar()
                        if not check:
                            continue
                    except Exception:
                        continue

                    # Count and update
                    count = conn.execute(
                        text(f"SELECT COUNT(*) FROM {table} WHERE {col} = :uid"),
                        {"uid": uid}
                    ).scalar()

                    if count and count > 0:
                        print(f"  Reassigning {table}.{col}: {count} record(s) from user {uid} to Super Admin ({super_admin_id})")
                        conn.execute(
                            text(f"UPDATE {table} SET {col} = :new_uid WHERE {col} = :old_uid"),
                            {"new_uid": super_admin_id, "old_uid": uid}
                        )
                        total_updated += count
                        updates_by_table[table] = updates_by_table.get(table, 0) + count

        print(f"\n{'=' * 60}")
        print(f"Total records reassigned: {total_updated}")
        print(f"{'=' * 60}")
        for table, count in sorted(updates_by_table.items()):
            print(f"  {table}: {count} record(s)")

        # Soft-delete the target users
        print(f"\n--- Soft-deleting {len(target_ids)} user(s) ---")
        for uid in target_ids:
            conn.execute(
                text("UPDATE users SET is_deleted = TRUE, deleted_at = NOW(), deleted_by_id = :admin_id WHERE id = :uid"),
                {"admin_id": super_admin_id, "uid": uid}
            )
            print(f"  User ID={uid} set as deleted (is_deleted=1)")

        trans.commit()
        print(f"\nAll changes committed successfully.")

        # Verify no remaining records reference the deleted users
        print(f"\n--- Verification ---")
        remaining = 0
        for uid in target_ids:
            for table, columns in USER_FK_COLUMNS.items():
                for col in columns:
                    try:
                        check = conn.execute(
                            text(f"SELECT COUNT(*) FROM information_schema.columns "
                                 f"WHERE table_name = :t AND column_name = :c"),
                            {"t": table, "c": col}
                        ).scalar()
                        if not check:
                            continue
                    except Exception:
                        continue
                    count = conn.execute(
                        text(f"SELECT COUNT(*) FROM {table} WHERE {col} = :uid"),
                        {"uid": uid}
                    ).scalar()
                    if count and count > 0:
                        print(f"  WARNING: {table}.{col} still has {count} reference(s) to user {uid}")
                        remaining += count

        if remaining == 0:
            print("  No remaining references to deleted users. All clean!")
        else:
            print(f"  Total remaining references: {remaining}")

    except Exception as e:
        trans.rollback()
        print(f"ERROR: {e}")
        sys.exit(1)

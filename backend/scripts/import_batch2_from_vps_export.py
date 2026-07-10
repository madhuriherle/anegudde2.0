"""
One-off import: system_settings, donation types/config (excluding devotees
and donation_entries), receipt_sequences, token system, remaining purchase
entries/bills, item_prices, item_serial_numbers, and purchase returns from
a VPS export JSON into the local DB.

Same approach as import_txn_from_vps_export.py: dependency tables are
inserted with their original VPS ids preserved (local tables assumed
empty), FK checks are disabled during the bulk insert (session_replication_role),
and item_id references are re-resolved by item_name against local items
(whose ids differ from VPS since items were imported earlier via
natural-key upsert).

Requires the token_details_2026_07 partition (or whichever month(s) the
export's token_details rows fall in) to already exist locally.

Usage:
    python scripts/import_batch2_from_vps_export.py <path_to_export.json>
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
from app.db.session import DATABASE_URL

PSYCOPG2_URL = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://")

DEPENDENCY_TABLES = [
    "system_settings",
    "donation_types",
    "donation_amount_masters",
    "donation_type_modules",
    "receipt_sequences",
    "token_generations",
    "token_details",
    "purchase_entries",
    "purchase_bills",
    "purchase_return_entries",
]

LINKED_TABLES = {
    "purchase_items": {"item_id": "item_name"},
    "item_prices": {"item_id": "item_name"},
    "item_serial_numbers": {"item_id": "item_name"},
    "purchase_return_items": {"item_id": "item_name"},
}


def insert_row(cur, table, row):
    cols = list(row.keys())
    placeholders = ", ".join(["%s"] * len(cols))
    col_list = ", ".join(f'"{c}"' for c in cols)
    sql = f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
    cur.execute(sql, [row[c] for c in cols])


def main(export_path):
    with open(export_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    conn = psycopg2.connect(PSYCOPG2_URL)
    cur = conn.cursor()
    try:
        cur.execute("SET session_replication_role = 'replica'")

        for table in DEPENDENCY_TABLES:
            rows = data.get(table, [])
            for row in rows:
                insert_row(cur, table, row)
            print(f"  {table}: inserted {len(rows)} row(s)")

        cur.execute("SELECT id, item_name FROM items")
        item_id_by_name = {name: iid for iid, name in cur.fetchall()}

        for table, fk_map in LINKED_TABLES.items():
            rows = data.get(table, [])
            inserted = 0
            for row in rows:
                row = dict(row)
                skip = False
                for fk_col, name_col in fk_map.items():
                    name_val = row.pop(name_col, None)
                    local_id = item_id_by_name.get(name_val)
                    if local_id is None:
                        print(f"  SKIP {table} row id={row.get('id')}, unknown item={name_val!r}")
                        skip = True
                        break
                    row[fk_col] = local_id
                if skip:
                    continue
                insert_row(cur, table, row)
                inserted += 1
            print(f"  {table}: inserted {inserted} row(s)")

        for table in DEPENDENCY_TABLES + list(LINKED_TABLES.keys()):
            if table == "donation_type_modules":
                continue  # composite PK, no sequence
            cur.execute(
                f"""
                SELECT setval(
                    pg_get_serial_sequence('{table}', 'id'),
                    COALESCE((SELECT MAX(id) FROM "{table}"), 1)
                )
                """
            )

        cur.execute("SET session_replication_role = 'origin'")
        conn.commit()
        print("Import complete.")
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main(sys.argv[1])

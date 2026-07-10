"""
One-off import: load roles/users/vendors/financial_years plus one specific
purchase entry and one specific consumption entry (with their line items,
wastage, and stock adjustments) from a VPS export JSON into the local DB.

Dependency tables (modules, privileges, roles, role_privileges, users,
vendors, financial_years, purchase_entries, consumption_entries,
wastage_entries) are assumed EMPTY locally and are inserted with their
original VPS ids preserved, so FKs between them stay valid without
remapping. item_id / menu_item_id references are re-resolved by name
against the local items/menu_items tables (whose local ids differ from
VPS, since those were imported earlier via natural-key upsert).

Usage:
    python scripts/import_txn_from_vps_export.py <path_to_export.json>
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
from app.db.session import DATABASE_URL

# psycopg2 needs a plain DSN, not the SQLAlchemy "+psycopg2" URL
PSYCOPG2_URL = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://")

DEPENDENCY_TABLES = [
    "modules",
    "privileges",
    "roles",
    "role_privileges",
    "users",
    "vendors",
    "financial_years",
    "purchase_entries",
    "consumption_entries",
    "wastage_entries",
]

# tables that need item_id / menu_item_id resolved by name against local data
LINKED_TABLES = {
    "purchase_items": {"item_id": "item_name"},
    "consumption_items": {"item_id": "item_name"},
    "wastage_items": {"item_id": "item_name", "menu_item_id": "menu_dish_name"},
    "stock_adjustments": {"item_id": "item_name"},
}


def insert_row(cur, table, row):
    cols = list(row.keys())
    placeholders = ", ".join(["%s"] * len(cols))
    col_list = ", ".join(f'"{c}"' for c in cols)
    sql = f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING'
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

        # build item_name -> local id, and dish_name -> local id lookups
        cur.execute("SELECT id, item_name FROM items")
        item_id_by_name = {name: iid for iid, name in cur.fetchall()}
        cur.execute("SELECT id, dish_name FROM menu_items")
        menu_id_by_name = {name: iid for iid, name in cur.fetchall()}

        lookup_by_col = {"item_name": item_id_by_name, "menu_dish_name": menu_id_by_name}

        for table, fk_map in LINKED_TABLES.items():
            rows = data.get(table, [])
            inserted = 0
            for row in rows:
                row = dict(row)
                skip = False
                for fk_col, name_col in fk_map.items():
                    name_val = row.pop(name_col, None)
                    if name_val is None:
                        row[fk_col] = None
                        continue
                    local_id = lookup_by_col[name_col].get(name_val)
                    if local_id is None:
                        print(f"  SKIP {table} row id={row.get('id')}, unknown {name_col}={name_val!r}")
                        skip = True
                        break
                    row[fk_col] = local_id
                if skip:
                    continue
                insert_row(cur, table, row)
                inserted += 1
            print(f"  {table}: inserted {inserted} row(s)")

        # reset sequences for every table we touched (ids were inserted explicitly)
        for table in DEPENDENCY_TABLES + list(LINKED_TABLES.keys()):
            cur.execute(
                f"""
                SELECT setval(
                    pg_get_serial_sequence('{table}', 'id'),
                    COALESCE((SELECT MAX(id) FROM {table}), 1)
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

"""
One-off import: load items/categories/units/stock_ledger from a VPS export
JSON (produced by an ad-hoc export script) into the local database, mapping
records by natural keys (name/code) rather than raw IDs since local and VPS
IDs don't line up.

Usage:
    python scripts/import_items_from_vps_export.py <path_to_export.json>
"""
import json
import os
import sys
from decimal import Decimal

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.db.models import ItemType, ItemCategory, Unit, Item, StockLedger


def to_decimal(v):
    return None if v is None else Decimal(v)


def main(export_path):
    with open(export_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    db = SessionLocal()
    try:
        # 1. item_types
        type_by_name = {}
        for t in data["item_types"]:
            obj = db.query(ItemType).filter(ItemType.type_name == t["type_name"]).first()
            if not obj:
                obj = ItemType(type_name=t["type_name"], status=t["status"])
                db.add(obj)
                db.flush()
                print(f"  created item_type: {t['type_name']}")
            type_by_name[t["type_name"]] = obj

        # 2. item_categories
        category_by_key = {}
        for c in data["item_categories"]:
            type_obj = type_by_name[c["type_name"]]
            obj = (
                db.query(ItemCategory)
                .filter(ItemCategory.category_name == c["category_name"], ItemCategory.type_id == type_obj.id)
                .first()
            )
            if not obj:
                obj = ItemCategory(category_name=c["category_name"], type_id=type_obj.id, status=c["status"])
                db.add(obj)
                db.flush()
                print(f"  created item_category: {c['category_name']}")
            category_by_key[(c["type_name"], c["category_name"])] = obj

        # 3. units
        unit_by_code = {}
        for u in data["units"]:
            obj = db.query(Unit).filter(Unit.unit_code == u["unit_code"]).first()
            if not obj:
                obj = Unit(unit_name=u["unit_name"], unit_code=u["unit_code"], status=u["status"])
                db.add(obj)
                db.flush()
                print(f"  created unit: {u['unit_name']} ({u['unit_code']})")
            unit_by_code[u["unit_code"]] = obj
        db.flush()

        # 4. items
        item_by_name = {}
        for it in data["items"]:
            category_obj = category_by_key.get((it["type_name"], it["category_name"])) if it["category_name"] else None
            unit_obj = unit_by_code[it["unit_code"]]
            obj = db.query(Item).filter(Item.item_name == it["item_name"]).first()
            if obj:
                obj.category_id = category_obj.id if category_obj else None
                obj.unit_id = unit_obj.id
                obj.opening_stock = to_decimal(it["opening_stock"])
                obj.opening_price = to_decimal(it["opening_price"])
                obj.current_stock = to_decimal(it["current_stock"])
                obj.default_price = to_decimal(it["default_price"])
                obj.min_stock_level = to_decimal(it["min_stock_level"])
                obj.max_stock_level = to_decimal(it["max_stock_level"])
                obj.status = it["status"]
                obj.display_order = it["display_order"]
                print(f"  updated item: {it['item_name']}")
            else:
                obj = Item(
                    item_name=it["item_name"],
                    display_order=it["display_order"],
                    category_id=category_obj.id if category_obj else None,
                    unit_id=unit_obj.id,
                    opening_stock=to_decimal(it["opening_stock"]) or 0,
                    opening_price=to_decimal(it["opening_price"]),
                    current_stock=to_decimal(it["current_stock"]) or 0,
                    default_price=to_decimal(it["default_price"]),
                    min_stock_level=to_decimal(it["min_stock_level"]),
                    max_stock_level=to_decimal(it["max_stock_level"]),
                    status=it["status"],
                )
                db.add(obj)
                db.flush()
                print(f"  created item: {it['item_name']}")
            item_by_name[it["item_name"]] = obj
        db.flush()

        # 5. stock_ledger (local table is empty, so plain bulk insert)
        existing_count = db.query(StockLedger).count()
        if existing_count == 0:
            for sl in data["stock_ledger"]:
                item_obj = item_by_name.get(sl["item_name"])
                if not item_obj:
                    print(f"  SKIP stock_ledger row, unknown item: {sl['item_name']}")
                    continue
                db.add(
                    StockLedger(
                        txn_date=sl["txn_date"],
                        item_id=item_obj.id,
                        txn_type=sl["txn_type"],
                        ref_table=sl["ref_table"],
                        ref_id=sl["ref_id"],
                        qty_in=to_decimal(sl["qty_in"]) or 0,
                        qty_out=to_decimal(sl["qty_out"]) or 0,
                        unit_cost=to_decimal(sl["unit_cost"]) or 0,
                        value_in=to_decimal(sl["value_in"]) or 0,
                        value_out=to_decimal(sl["value_out"]) or 0,
                        balance=to_decimal(sl["balance"]) or 0,
                        current_value=to_decimal(sl["current_value"]) or 0,
                        status=sl["status"],
                        created_at=sl["created_at"],
                    )
                )
            print(f"  inserted {len(data['stock_ledger'])} stock_ledger rows")
        else:
            print(f"  SKIPPED stock_ledger import - local table already has {existing_count} rows")

        db.commit()
        print("Import complete.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main(sys.argv[1])

import sys, os
from datetime import date
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import StockLedger, Item

db = SessionLocal()
today = date.today()

print("=== Item current_stock ===")
items = db.query(Item).filter(
    Item.is_deleted == False,
    Item.item_name.in_([
        "\u0c85\u0c95\u0ccd\u0c95\u0cbf (Rice)",
        "\u0cac\u0cc6\u0cb2\u0ccd\u0cb2 (Jaggery)",
        "\u0ca4\u0cca\u0c97\u0cb0\u0cbf \u0cac\u0cc7\u0cb3\u0cc6 (Toor Dal)",
        "\u0c97\u0ccb\u0ca7\u0cbf \u0c95\u0ca1\u0cbf (Wheat Rava)",
        "\u0c92\u0ca3\u0cae\u0cc6\u0ca3\u0cb8\u0cc1 (Dry Chilli)",
        "\u0cb9\u0cc1\u0ca3\u0cb8\u0cc6 \u0cb9\u0ca3\u0ccd\u0ca3\u0cc1 (Tamarind)",
    ])
).all()
for it in items:
    print(f"{it.id}: {it.item_name} -> current_stock = {float(it.current_stock or 0)}")

print("\n=== Today's stock_adjustment Ledger entries ===")
ledgers = db.query(StockLedger).filter(
    StockLedger.txn_date == today,
    StockLedger.ref_table == "stock_adjustments"
).order_by(StockLedger.item_id).all()

if not ledgers:
    print("NO ENTRIES FOUND!")
else:
    for l in ledgers:
        item = db.query(Item).filter(Item.id == l.item_id).first()
        iname = item.item_name if item else "?"
        print(f"item={iname} | qty_in={float(l.qty_in):>8.3f} | qty_out={float(l.qty_out):>8.3f} | balance={float(l.balance):>8.3f}")

    # Verify: for each item, the latest ledger balance should match current_stock
    print("\n=== Verification ===")
    for it in items:
        item_ledgers = [l for l in ledgers if l.item_id == it.id]
        if item_ledgers:
            last = item_ledgers[-1]
            match = "✓" if float(last.balance) == float(it.current_stock or 0) else "✗"
            print(f"{match} {it.item_name}: ledger_balance={float(last.balance)} == current_stock={float(it.current_stock or 0)}")
        else:
            print(f"? {it.item_name}: no ledger entry for today")

db.close()

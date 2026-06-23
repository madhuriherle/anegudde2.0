import sys, os
from datetime import date, datetime, timezone
from decimal import Decimal
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import Item, StockLedger
from sqlalchemy import func

db = SessionLocal()
today = date.today()

# Check current state
items = db.query(Item).filter(Item.is_deleted == False, Item.id.in_([1,3,4,18,19,25])).all()
for item in items:
    opening = Decimal(item.opening_stock or "0")
    net_all = db.query(func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0))\
        .filter(StockLedger.item_id == item.id, StockLedger.status == 1)\
        .scalar() or 0
    calc_closing = opening + Decimal(str(net_all))
    actual = Decimal(item.current_stock or 0)
    print(f"{item.id} {item.item_name}: opening={float(opening)} ledger_net={net_all} calc_closing={float(calc_closing)} current_stock={float(actual)}")

# Count stock_adjustment entries left
count = db.query(StockLedger).filter(
    StockLedger.ref_table == "stock_adjustments",
    StockLedger.txn_date == today
).count()
print(f"\nStock_adjustment entries today: {count}")

db.close()

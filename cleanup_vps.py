import sys, os
from datetime import date, datetime, timezone
from decimal import Decimal
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import Item, StockLedger
from sqlalchemy import func

db = SessionLocal()
today = date.today()

# Step 1: Delete ALL stock_adjustment ledger entries from today (my mess)
deleted = db.query(StockLedger).filter(
    StockLedger.txn_date == today,
    StockLedger.ref_table == "stock_adjustments"
).delete(synchronize_session=False)
print(f"Deleted {deleted} bogus stock_adjustment entries")

db.commit()

# Step 2: For each item, compute closing balance from remaining ledger and sync current_stock
items = db.query(Item).filter(Item.is_deleted == False).all()
for item in items:
    opening = Decimal(item.opening_stock or "0")
    net_all = db.query(func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0))\
        .filter(StockLedger.item_id == item.id, StockLedger.status == 1)\
        .scalar() or 0
    calc_closing = opening + Decimal(str(net_all))
    old_stock = Decimal(item.current_stock or 0)

    if calc_closing != old_stock:
        item.current_stock = float(calc_closing)
        item.updated_at = datetime.now(timezone.utc)
        s = float(calc_closing)
        if s != 0:
            print(f"{item.item_name}: current_stock {float(old_stock)} -> {float(calc_closing)}")

db.commit()

print("\nDone - all current_stock synced to ledger closing balances")
db.close()

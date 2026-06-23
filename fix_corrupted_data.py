import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import StockLedger, Item
from datetime import datetime, timezone

db = SessionLocal()
ids = [52, 54, 55, 57, 58, 59]

# Delete corrupted ledger entries
deleted = db.query(StockLedger).filter(StockLedger.item_id.in_(ids)).delete(synchronize_session=False)
print(f"Deleted {deleted} corrupted ledger entries")

# Reset current_stock = opening_stock for each item
items = db.query(Item).filter(Item.id.in_(ids)).all()
now = datetime.now(timezone.utc)
for it in items:
    it.current_stock = it.opening_stock
    it.updated_at = now
    print(f"{it.id} {it.item_name}: current={float(it.current_stock or 0)}")

db.commit()

# Verify
items2 = db.query(Item).filter(Item.id.in_(ids)).all()
print("\n=== Verify ===")
for it in items2:
    print(f"OK {it.item_name}: opening={float(it.opening_stock or 0)} current={float(it.current_stock or 0)}")

db.close()

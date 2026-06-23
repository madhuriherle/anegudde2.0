import sys, os
from datetime import date, datetime, timezone
from decimal import Decimal
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import Item, StockLedger, StockAdjustment
from sqlalchemy import func

db = SessionLocal()
today = date.today()

# Get count of entries to delete
count = db.query(StockLedger).filter(StockLedger.txn_date < today).count()
adj_count = db.query(StockAdjustment).filter(StockAdjustment.adjustment_date < today).count()
print(f"StockLedger entries before today: {count}")
print(f"StockAdjustment entries before today: {adj_count}")

# Delete StockLedger before today
db.query(StockLedger).filter(StockLedger.txn_date < today).delete(synchronize_session=False)
print("Deleted StockLedger entries before today")

# Delete StockAdjustment before today
db.query(StockAdjustment).filter(StockAdjustment.adjustment_date < today).delete(synchronize_session=False)
print("Deleted StockAdjustment entries before today")

# Reset opening_stock to 0 for all items
db.query(Item).filter(Item.is_deleted == False).update({"opening_stock": 0}, synchronize_session=False)
print("Reset opening_stock to 0 for all items")

# Verify closing = current_stock for all items
items = db.query(Item).filter(Item.is_deleted == False).all()
for item in items:
    net = db.query(func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0))\
        .filter(StockLedger.item_id == item.id, StockLedger.status == 1)\
        .scalar() or 0
    calc_closing = Decimal(str(net))
    actual = Decimal(item.current_stock or 0)
    if calc_closing != actual:
        # Sync current_stock to match
        item.current_stock = float(calc_closing)
        item.updated_at = datetime.now(timezone.utc)

db.commit()

# Final verification
print("\n=== Final Verification ===")
items = db.query(Item).filter(Item.is_deleted == False).order_by(Item.id).all()
for item in items:
    net = db.query(func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0))\
        .filter(StockLedger.item_id == item.id, StockLedger.status == 1)\
        .scalar() or 0
    calc_closing = Decimal(str(net))
    actual = Decimal(item.current_stock or 0)
    s = float(actual)
    if s > 0 or calc_closing != actual:
        match = "✓" if calc_closing == actual else "✗"
        print(f"{match} {item.item_name}: opening=0 ledger_net={net} closing={float(calc_closing)} current={float(actual)}")

db.close()

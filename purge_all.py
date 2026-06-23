import sys, os
from datetime import datetime, timezone
from decimal import Decimal
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import Item, StockLedger, StockAdjustment

db = SessionLocal()

lc = db.query(StockLedger).count()
ac = db.query(StockAdjustment).count()
print(f"Before: StockLedger={lc}, StockAdjustment={ac}")

db.query(StockLedger).delete(synchronize_session=False)
db.query(StockAdjustment).delete(synchronize_session=False)
db.query(Item).filter(Item.is_deleted == False).update({
    "current_stock": 0,
    "opening_stock": 0,
    "updated_at": datetime.now(timezone.utc)
}, synchronize_session=False)

db.commit()

lc2 = db.query(StockLedger).count()
ac2 = db.query(StockAdjustment).count()
print(f"After: StockLedger={lc2}, StockAdjustment={ac2}")
print("All items reset to 0 stock ✓")

db.close()

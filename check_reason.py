import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import StockAdjustment

db = SessionLocal()

adjs = db.query(StockAdjustment).order_by(StockAdjustment.id.desc()).limit(10).all()
for a in adjs:
    print(f"id={a.id} item={a.item_id} qty={a.adjusted_qty} reason='{a.reason}' created_by={a.created_by}")
db.close()

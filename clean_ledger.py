import sys, os
from datetime import date
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import StockLedger

db = SessionLocal()
today = date.today()
deleted = db.query(StockLedger).filter(
    StockLedger.txn_date == today,
    StockLedger.ref_table == 'stock_adjustments',
    StockLedger.ref_id >= 26
).delete(synchronize_session=False)
db.commit()
db.close()
print(f"Deleted {deleted} duplicate ledger entries")

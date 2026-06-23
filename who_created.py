import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import StockLedger, User, StockAdjustment

db = SessionLocal()

# Last 5 stock_adjustment ledger entries
ledgers = db.query(StockLedger).filter(
    StockLedger.ref_table == "stock_adjustments"
).order_by(StockLedger.id.desc()).limit(10).all()

print("=== Last 10 StockLedger adjustments ===")
for l in ledgers:
    u = db.query(User).filter(User.id == l.created_by).first()
    uname = f"{u.username} (id={u.id})" if u else f"UNKNOWN (id={l.created_by})"
    print(f"id={l.id} date={l.txn_date} user={uname} qty_in={l.qty_in}")

# Check the StockAdjustment table for the big entry
print("\n=== StockAdjustment entries (last 5) ===")
adjs = db.query(StockAdjustment).order_by(StockAdjustment.id.desc()).limit(5).all()
for a in adjs:
    u = db.query(User).filter(User.id == a.created_by).first()
    uname = f"{u.username} (id={u.id})" if u else f"UNKNOWN (id={a.created_by})"
    print(f"id={a.id} date={a.adjustment_date} user={uname} item={a.item_id} qty={a.adjusted_qty} reason={a.reason}")

db.close()

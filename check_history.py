import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import StockLedger, Item

db = SessionLocal()
items = db.query(Item).filter(Item.is_deleted == False).order_by(Item.id).all()
for item in items:
    s = float(item.current_stock or 0)
    if s > 0:
        entries = db.query(StockLedger).filter(StockLedger.item_id == item.id).order_by(StockLedger.id).all()
        print(f"\n{item.id}: {item.item_name} | current={s} | opening={float(item.opening_stock or 0)} | {len(entries)} entries")
        for e in entries:
            print(f"  id={e.id} date={e.txn_date} type={e.txn_type} ref={e.ref_table}({e.ref_id}) in={float(e.qty_in or 0)} out={float(e.qty_out or 0)} balance={float(e.balance or 0)}")

db.close()

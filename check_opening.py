import sys, os
from datetime import date
from decimal import Decimal
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import Item, StockLedger

db = SessionLocal()
today = date.today()

# Check what entries exist BEFORE today for Akki (item_id=1)
entries = db.query(StockLedger).filter(
    StockLedger.item_id == 1,
    StockLedger.txn_date < today,
    StockLedger.status == 1
).order_by(StockLedger.txn_date).all()

if not entries:
    print("No entries before today")
else:
    net = Decimal(0)
    for e in entries:
        net += Decimal(e.qty_in or 0) - Decimal(e.qty_out or 0)
        print(f"  {e.txn_date} txn_type={e.txn_type} ref={e.ref_table} in={float(e.qty_in or 0)} out={float(e.qty_out or 0)} net_sofar={float(net)}")

item = db.query(Item).filter(Item.id == 1).first()
print(f"\nOpening stock (item table): {float(item.opening_stock or 0)}")
print(f"Net before today: {float(net)}")
print(f"Expected opening: {float(Decimal(item.opening_stock or 0) + net)}")

db.close()

import sys, os
from datetime import datetime, timezone
from decimal import Decimal
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import StockLedger, Item, User

db = SessionLocal()
user = db.query(User).filter(User.is_deleted == False).order_by(User.id).first()
uid = user.id if user else 1
now = datetime.now(timezone.utc)
today = now.date()

items = db.query(Item).filter(Item.id.in_([52, 54, 55, 57, 58, 59])).all()
for item in items:
    if float(item.opening_stock or 0) > 0:
        unit_cost = item.default_price or 0
        db.add(StockLedger(
            item_id=item.id,
            txn_date=today,
            txn_type=8,
            ref_table="items",
            ref_id=item.id,
            qty_in=Decimal(str(item.opening_stock)),
            qty_out=0,
            unit_cost=unit_cost,
            value_in=Decimal(str(item.opening_stock)) * unit_cost,
            value_out=0,
            balance=Decimal(str(item.opening_stock)),
            current_value=Decimal(str(item.opening_stock)) * unit_cost,
            created_at=now,
            updated_at=now,
            created_by=uid,
            updated_by=uid,
        ))
        print(f"Created opening entry for {item.item_name}: +{float(item.opening_stock)}")

db.commit()

# Verify
print("\n=== History ===")
for item in items:
    entries = db.query(StockLedger).filter(StockLedger.item_id == item.id).order_by(StockLedger.id).all()
    for e in entries:
        print(f"{item.item_name}: type={e.txn_type} in={float(e.qty_in)} out={float(e.qty_out)} balance={float(e.balance)}")

db.close()

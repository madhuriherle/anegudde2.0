import sys, os
from datetime import datetime, timezone
from decimal import Decimal
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import StockLedger, ConsumptionItem, ConsumptionEntry, Item, User

db = SessionLocal()
user = db.query(User).filter(User.is_deleted == False).order_by(User.id).first()
uid = user.id if user else 1
now = datetime.now(timezone.utc)

# Get usage entry 53
entry = db.query(ConsumptionEntry).filter(ConsumptionEntry.id == 53).first()
if not entry:
    print("Usage entry 53 not found")
    exit()

items = db.query(ConsumptionItem).filter(ConsumptionItem.consumption_entry_id == 53).all()
for ci in items:
    item = db.query(Item).filter(Item.id == ci.item_id).first()
    if not item:
        continue

    opening = Decimal(item.opening_stock or "0")
    # Net ledger excluding txn_type=8
    from sqlalchemy import func
    net_before = db.query(func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0))\
        .filter(
            StockLedger.item_id == item.id,
            StockLedger.status == 1,
            StockLedger.txn_date <= entry.usage_date,
            StockLedger.txn_type != 8
        ).scalar() or 0

    available = opening + Decimal(str(net_before))
    used = Decimal(str(ci.quantity_used))
    issue_balance = available - used
    return_balance = issue_balance + Decimal(str(ci.qty_returned))
    unit_cost = ci.unit_cost_at_time or item.default_price or 0

    db.add(StockLedger(
        item_id=item.id,
        txn_date=entry.usage_date,
        txn_type=2,
        ref_table="consumption_entries:RAW_ISSUE",
        ref_id=entry.id,
        qty_in=0,
        qty_out=used,
        unit_cost=unit_cost,
        value_in=0,
        value_out=used * unit_cost,
        balance=issue_balance,
        current_value=issue_balance * unit_cost,
        status=1,
        created_at=now,
        updated_at=now,
        created_by=uid,
        updated_by=uid,
    ))

    # Update current_stock
    item.current_stock = return_balance
    item.updated_at = now

    print(f"{item.item_name}: out={float(used)} balance={float(issue_balance)} current={float(return_balance)}")

db.commit()

print("\n=== History ===")
for item in [db.query(Item).filter(Item.id == ci.item_id).first() for ci in items]:
    entries = db.query(StockLedger).filter(StockLedger.item_id == item.id).order_by(StockLedger.id).all()
    for e in entries:
        print(f"{item.item_name}: type={e.txn_type} in={float(e.qty_in)} out={float(e.qty_out)} balance={float(e.balance)}")

db.close()

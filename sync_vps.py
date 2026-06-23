import sys, os
from datetime import date, datetime, timezone
from decimal import Decimal
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import Item, StockLedger, StockAdjustment, User
from sqlalchemy import func

db = SessionLocal()
user = db.query(User).filter(User.is_deleted == False).order_by(User.id).first()
user_id = user.id if user else 1
today = date.today()
now = datetime.now(timezone.utc)

item_ids = [1, 3, 4, 18, 19, 25]  # Akki, Bella, Togari, Hunase, Godi Kadi, Ona Menasu

# Get max ref_id
max_ref = db.query(func.max(StockLedger.ref_id)).filter(StockLedger.ref_table == "stock_adjustments").scalar() or 0
max_adj_id = db.query(func.max(StockAdjustment.id)).scalar() or 0

for idx, iid in enumerate(item_ids):
    item = db.query(Item).filter(Item.id == iid).first()
    if not item:
        continue

    opening = Decimal(item.opening_stock or "0")
    # Ledger net EXCLUDING stock_adjustments (since they're deleted)
    net = db.query(func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0))\
        .filter(
            StockLedger.item_id == item.id,
            StockLedger.status == 1
        )\
        .scalar() or 0

    ledger_closing = opening + Decimal(str(net))
    actual = Decimal(item.current_stock or 0)
    diff = actual - ledger_closing

    if diff == 0:
        print(f"{item.item_name}: already matches ({float(actual)})")
        continue

    # Create StockAdjustment record
    new_adj = StockAdjustment(
        consumption_entry_id=None,
        adjustment_date=today,
        item_id=item.id,
        adjusted_qty=diff,
        reason="System sync - matching ledger to current stock",
        user_id=user_id,
        created_at=now,
        created_by=user_id
    )
    db.add(new_adj)
    db.flush()

    # Create StockLedger entry
    unit_cost = item.default_price or 0
    db.add(StockLedger(
        item_id=item.id,
        txn_date=today,
        txn_type=4,
        ref_table="stock_adjustments",
        ref_id=new_adj.id,
        qty_in=diff if diff > 0 else 0,
        qty_out=abs(diff) if diff < 0 else 0,
        unit_cost=unit_cost,
        value_in=(diff * unit_cost) if diff > 0 else 0,
        value_out=(abs(diff) * unit_cost) if diff < 0 else 0,
        balance=actual,
        current_value=actual * unit_cost,
        status=1,
        created_at=now,
        updated_at=now,
        created_by=user_id,
        updated_by=user_id,
    ))

    print(f"{item.item_name}: ledger={float(ledger_closing)} +{float(diff)} = {float(actual)} ✓")

db.commit()

# Verify
print("\n=== Verify ===")
for iid in item_ids:
    item = db.query(Item).filter(Item.id == iid).first()
    opening = Decimal(item.opening_stock or "0")
    net_all = db.query(func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0))\
        .filter(StockLedger.item_id == item.id, StockLedger.status == 1)\
        .scalar() or 0
    calc_closing = opening + Decimal(str(net_all))
    actual = Decimal(item.current_stock or 0)
    match = "✓" if calc_closing == actual else "✗"
    print(f"{match} {item.item_name}: closing={float(calc_closing)} current={float(actual)}")

db.close()

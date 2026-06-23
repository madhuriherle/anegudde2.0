import sys, os
from datetime import date, datetime, timezone
from decimal import Decimal
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import Item, StockLedger, User
from sqlalchemy import func

ITEMS = [
    "\u0c85\u0c95\u0ccd\u0c95\u0cbf (Rice)",
    "\u0cac\u0cc6\u0cb2\u0ccd\u0cb2 (Jaggery)",
    "\u0ca4\u0cca\u0c97\u0cb0\u0cbf \u0cac\u0cc7\u0cb3\u0cc6 (Toor Dal)",
    "\u0c97\u0ccb\u0ca7\u0cbf \u0c95\u0ca1\u0cbf (Wheat Rava)",
    "\u0c92\u0ca3\u0cae\u0cc6\u0ca3\u0cb8\u0cc1 (Dry Chilli)",
    "\u0cb9\u0cc1\u0ca3\u0cb8\u0cc6 \u0cb9\u0ca3\u0ccd\u0ca3\u0cc1 (Tamarind)",
]

db = SessionLocal()
user = db.query(User).filter(User.is_deleted == False).order_by(User.id).first()
user_id = user.id if user else 1
today = date.today()
now = datetime.now(timezone.utc)

# Step 1: Delete ALL today's stock_adjustment entries for these items
item_ids = db.query(Item.id).filter(Item.item_name.in_(ITEMS), Item.is_deleted == False).all()
item_ids = [r[0] for r in item_ids]
deleted = db.query(StockLedger).filter(
    StockLedger.txn_date == today,
    StockLedger.ref_table == "stock_adjustments",
    StockLedger.item_id.in_(item_ids)
).delete(synchronize_session=False)
print(f"Deleted {deleted} old adjustment entries")

max_ref = db.query(func.max(StockLedger.ref_id)).filter(StockLedger.ref_table == "stock_adjustments").scalar() or 0

for idx, name in enumerate(ITEMS):
    item = db.query(Item).filter(Item.item_name == name, Item.is_deleted == False).first()
    if not item:
        print(f"Not found: {name}")
        continue

    # Net before today (excluding today entries)
    net_before = db.query(func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0))\
        .filter(StockLedger.item_id == item.id, StockLedger.txn_date < today, StockLedger.status == 1)\
        .scalar() or 0

    opening = Decimal(item.opening_stock or "0")
    closing_before = opening + Decimal(str(net_before))
    actual = Decimal(item.current_stock or 0)

    diff = actual - closing_before

    if diff == 0:
        print(f"OK: {name} = {actual} (no adjustment needed)")
        continue

    db.add(StockLedger(
        item_id=item.id,
        txn_date=today,
        txn_type=4,
        ref_table="stock_adjustments",
        ref_id=max_ref + idx + 1,
        qty_in=diff if diff > 0 else 0,
        qty_out=abs(diff) if diff < 0 else 0,
        unit_cost=item.default_price or 0,
        value_in=(diff * (item.default_price or 0)) if diff > 0 else 0,
        value_out=(abs(diff) * (item.default_price or 0)) if diff < 0 else 0,
        balance=actual,
        current_value=actual * (item.default_price or 0),
        status=1,
        created_at=now,
        updated_at=now,
        created_by=user_id,
        updated_by=user_id,
    ))
    print(f"{name}: {closing_before} + adjust {diff} = {actual} ✓")

db.commit()

# Verify by checking what Stock Summary report would compute
print("\n=== Report Verification ===")
for name in ITEMS:
    item = db.query(Item).filter(Item.item_name == name).first()
    if not item: continue

    opening = Decimal(item.opening_stock or "0")
    net_all = db.query(func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0))\
        .filter(StockLedger.item_id == item.id, StockLedger.status == 1)\
        .scalar() or 0
    calc_closing = opening + Decimal(str(net_all))
    actual = Decimal(item.current_stock or 0)
    match = "✓" if calc_closing == actual else f"✗ (closing={calc_closing})"
    print(f"{match} {name}: opening={opening} + net={net_all} = closing={calc_closing} vs current={actual}")

db.close()

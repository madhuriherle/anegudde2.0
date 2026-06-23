import sys, os
from datetime import date, datetime, timezone
from decimal import Decimal
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import Item, StockLedger, StockAdjustment
from sqlalchemy import func

db = SessionLocal()
today = date.today()

# Find today's stock_adjustment ledger entry for Akki (item_id=1)
ledger = db.query(StockLedger).filter(
    StockLedger.item_id == 1,
    StockLedger.txn_date == today,
    StockLedger.ref_table == "stock_adjustments"
).first()

adj = db.query(StockAdjustment).filter(
    StockAdjustment.id == ledger.ref_id
).first() if ledger else None

item = db.query(Item).filter(Item.id == 1).first()

if ledger and item:
    opening = Decimal(item.opening_stock or "0")
    net = db.query(func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0))\
        .filter(StockLedger.item_id == 1, StockLedger.status == 1)\
        .scalar() or 0
    ledger_closing = opening + Decimal(str(net))
    actual = Decimal(item.current_stock or 0)
    correct_diff = actual - ledger_closing

    print(f"Old adjust: {float(ledger.qty_in)}")
    print(f"Opening stock: {float(opening)}")
    print(f"Ledger net: {net}")
    print(f"Ledger closing: {float(ledger_closing)}")
    print(f"Current stock: {float(actual)}")
    print(f"Correct diff: {float(correct_diff)}")

    # Update ledger
    unit_cost = item.default_price or 0
    ledger.qty_in = correct_diff if correct_diff > 0 else 0
    ledger.qty_out = abs(correct_diff) if correct_diff < 0 else 0
    ledger.value_in = (correct_diff * unit_cost) if correct_diff > 0 else 0
    ledger.value_out = (abs(correct_diff) * unit_cost) if correct_diff < 0 else 0
    ledger.balance = actual
    ledger.current_value = actual * unit_cost

    if adj:
        adj.adjusted_qty = correct_diff

    db.commit()
    print(f"Updated adjust to {float(correct_diff)} ✓")
else:
    print("Ledger entry not found")

db.close()

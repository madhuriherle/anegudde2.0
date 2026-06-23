import sys, os
from datetime import date, datetime, timezone
from decimal import Decimal
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import Item, StockLedger, StockAdjustment
from sqlalchemy import func

db = SessionLocal()
today = date.today()

item = db.query(Item).filter(Item.id == 1).first()

# Get the existing stock_adjustment ledger entry
ledger = db.query(StockLedger).filter(
    StockLedger.item_id == 1,
    StockLedger.txn_date == today,
    StockLedger.ref_table == "stock_adjustments"
).first()

# Calculate net EXCLUDING this adjustment
net = db.query(func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0))\
    .filter(StockLedger.item_id == 1, StockLedger.status == 1)\
    .scalar() or 0

old_adj = Decimal(ledger.qty_in or 0) - Decimal(ledger.qty_out or 0)
net_without_adj = Decimal(str(net)) - old_adj

opening = Decimal(item.opening_stock or "0")
ledger_closing_without = opening + net_without_adj
actual = Decimal(item.current_stock or 0)
correct_adj = actual - ledger_closing_without

print(f"Opening stock: {float(opening)}")
print(f"Net excluding adjustment: {float(net_without_adj)}")
print(f"Ledger closing w/o adjust: {float(ledger_closing_without)}")
print(f"Current stock: {float(actual)}")
print(f"Correct adjustment: {float(correct_adj)}")

# Update
unit_cost = item.default_price or 0
ledger.qty_in = correct_adj if correct_adj > 0 else 0
ledger.qty_out = abs(correct_adj) if correct_adj < 0 else 0
ledger.value_in = (correct_adj * unit_cost) if correct_adj > 0 else 0
ledger.value_out = (abs(correct_adj) * unit_cost) if correct_adj < 0 else 0
ledger.balance = actual
ledger.current_value = actual * unit_cost
ledger.updated_at = datetime.now(timezone.utc)

adj = db.query(StockAdjustment).filter(StockAdjustment.id == ledger.ref_id).first()
if adj:
    adj.adjusted_qty = correct_adj

db.commit()

# Verify
total_net = db.query(func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0))\
    .filter(StockLedger.item_id == 1, StockLedger.status == 1).scalar() or 0
closing = opening + Decimal(str(total_net))
print(f"\nVerify: opening={float(opening)} + net={total_net} = closing={float(closing)} == current={float(actual)} {'✓' if closing == actual else '✗'}")

db.close()

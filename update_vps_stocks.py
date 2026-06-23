import sys, os
from datetime import date, datetime, timezone
from decimal import Decimal
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import Item, StockLedger, User
from sqlalchemy import func

# Item names and their CURRENT correct stock (already in Item.current_stock)
# We need to create ledger entries so the report matches
ITEMS = [
    "ಅಕ್ಕಿ (Rice)",
    "ಬೆಲ್ಲ (Jaggery)",
    "ತೊಗರಿ ಬೇಳೆ (Toor Dal)",
    "ಗೋಧಿ ಕಡಿ (Wheat Rava)",
    "ಒಣಮೆಣಸು (Dry Chilli)",
    "ಹುಣಸೆ ಹಣ್ಣು (Tamarind)",
]

db = SessionLocal()
today = date.today()
now = datetime.now(timezone.utc)

# Get a valid user ID dynamically to avoid FK violations
first_user = db.query(User).first()
if not first_user:
    print("ERROR: No users found in database to attribute stock changes to")
    sys.exit(1)
user_id = first_user.id

max_ref = db.query(func.max(StockLedger.ref_id)).filter(StockLedger.ref_table == "stock_adjustments").scalar() or 0

for idx, name in enumerate(ITEMS):
    item = db.query(Item).filter(Item.item_name == name, Item.is_deleted == False).first()
    if not item:
        print(f"Not found: {name}")
        continue

    # Calculate ledger balance for this item before today
    net = db.query(func.coalesce(func.sum(StockLedger.qty_in - StockLedger.qty_out), 0))\
        .filter(StockLedger.item_id == item.id, StockLedger.txn_date < today, StockLedger.status == 1)\
        .scalar() or 0
    net = Decimal(str(net))

    opening = Decimal(item.opening_stock or "0")
    ledger_balance = opening + net

    actual_stock = Decimal(item.current_stock or 0)
    diff = actual_stock - ledger_balance

    if diff == 0:
        print(f"OK (ledger matches): {name} = {actual_stock}")
        continue

    qty_in = diff if diff > 0 else 0
    qty_out = abs(diff) if diff < 0 else 0
    unit_cost = item.default_price or 0
    ref_id = max_ref + idx + 1

    db.add(StockLedger(
        item_id=item.id,
        txn_date=today,
        txn_type=4,
        ref_table="stock_adjustments",
        ref_id=ref_id,
        qty_in=qty_in,
        qty_out=qty_out,
        unit_cost=unit_cost,
        value_in=qty_in * unit_cost,
        value_out=qty_out * unit_cost,
        balance=actual_stock,
        current_value=actual_stock * unit_cost,
        status=1,
        created_at=now,
        updated_at=now,
        created_by=user_id,
        updated_by=user_id,
    ))

    print(f"{name}: ledger_balance={ledger_balance} -> actual={actual_stock} (adjust={diff})")

db.commit()
db.close()
print("\nDone")

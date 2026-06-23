import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import Item
from decimal import Decimal

db = SessionLocal()
item = db.query(Item).filter(Item.id == 1).first()
if item:
    item.opening_stock = Decimal("6.000")
    db.commit()
    print(f"Set opening_stock for {item.item_name} to 6.000")
    print(f"Now opening = 6 + (-6 ledger) = 0 ✓")
else:
    print("Item not found")
db.close()

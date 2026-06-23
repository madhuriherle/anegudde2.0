import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.session import SessionLocal
from app.db.models import Item

db = SessionLocal()
items = db.query(Item).filter(Item.is_deleted == False).order_by(Item.id).all()
for it in items:
    s = float(it.current_stock or 0)
    if s > 0:
        print(f"{it.id}: {it.item_name} | opening={float(it.opening_stock or 0)} | current={s}")
db.close()

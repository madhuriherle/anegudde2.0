import sys
sys.path.insert(0, "/var/www/anegudde/backend")
from app.db.session import SessionLocal
from app.db.models import ItemSerialNumber, Item

db = SessionLocal()
rows = db.query(ItemSerialNumber).join(Item).order_by(Item.id).all()
for r in rows:
    print(f"item_id={r.item_id}, serial={r.serial_number}")
db.close()

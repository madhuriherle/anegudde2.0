import sys
sys.path.insert(0, "/var/www/anegudde/backend")
from app.db.session import SessionLocal
from app.db.models import ItemSerialNumber, Item

db = SessionLocal()
rows = db.query(ItemSerialNumber).join(Item).order_by(Item.id).all()

print(f"Found {len(rows)} items")

# Phase 1: set to temporary unique values to avoid unique constraint conflicts
for idx, r in enumerate(rows, start=1):
    r.serial_number = f"_tmp_{idx}"
db.commit()
print("Phase 1 done: temporary values set")

# Phase 2: set to real sequential values
for idx, r in enumerate(rows, start=1):
    r.serial_number = str(idx)
db.commit()
print("Phase 2 done: sequential values set")

# Verify
rows2 = db.query(ItemSerialNumber).join(Item).order_by(Item.id).all()
for r in rows2:
    print(f"  item_id={r.item_id} => serial={r.serial_number}")

db.close()
print("Done.")

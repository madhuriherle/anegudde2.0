
import sys
import os
from sqlalchemy.orm import Session

# Ensure the app module can be found
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.db.models import Item, ItemSerialNumber
from app.db.session import SessionLocal

def link_serials():
    db = SessionLocal()
    try:
        items = db.query(Item).all()
        print(f"Assigning serial numbers to {len(items)} items...")
        
        for it in items:
            # We will use the ID as the default serial number for now
            serial_val = str(it.id)
            
            exists = db.query(ItemSerialNumber).filter(ItemSerialNumber.serial_number == serial_val).first()
            if not exists:
                new_serial = ItemSerialNumber(
                    item_id=it.id,
                    serial_number=serial_val,
                    status=1
                )
                db.add(new_serial)
                print(f"Linked Serial '{serial_val}' to Item '{it.item_name}'")
            else:
                print(f"Serial '{serial_val}' already exists for item_id {exists.item_id}")
        
        db.commit()
        print("\nSUCCESS: All items now have a serial number matching their ID.")
    finally:
        db.close()

if __name__ == "__main__":
    link_serials()

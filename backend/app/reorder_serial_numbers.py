
from app.db.session import SessionLocal
from app.db.models import Item, ItemSerialNumber
from sqlalchemy import case

def reorder_serials():
    db = SessionLocal()
    try:
        # Fetch all items sorted by:
        # 1. Status (Active=1 first)
        # 2. Display Order (Nulls last, then ascending)
        # 3. Item Name (A-Z)
        items = db.query(Item).order_by(
            Item.status.desc(),
            case((Item.display_order.is_(None), 1), else_=0).asc(),
            Item.display_order.asc(),
            Item.item_name.asc()
        ).all()

        print(f"Found {len(items)} items to reorder.")

        # Step 1: Assign temporary serial numbers to avoid unique constraint violations
        for item in items:
            serial_record = db.query(ItemSerialNumber).filter(ItemSerialNumber.item_id == item.id).first()
            temp_serial = f"TEMP_{item.id}_{datetime.now().timestamp()}"
            if serial_record:
                serial_record.serial_number = temp_serial
            else:
                new_record = ItemSerialNumber(item_id=item.id, serial_number=temp_serial, status=1)
                db.add(new_record)
        
        db.flush()
        print("Assigned temporary serial numbers.")

        # Step 2: Assign final sequential serial numbers
        for index, item in enumerate(items, start=1):
            new_serial = str(index)
            serial_record = db.query(ItemSerialNumber).filter(ItemSerialNumber.item_id == item.id).first()
            if serial_record:
                serial_record.serial_number = new_serial
                print(f"Final Update: {item.item_name} -> {new_serial}")

        db.commit()
        print("\nSerial numbers reordered successfully!")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    from datetime import datetime
    reorder_serials()

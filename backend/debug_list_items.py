
import sys
import os
from sqlalchemy.orm import Session

# Ensure the app module can be found
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.db.models import Item, ItemCategory, Unit
from app.db.session import SessionLocal

def list_items():
    db = SessionLocal()
    try:
        items = db.query(Item).all()
        print(f"Total items in DB: {len(items)}")
        for it in items:
            cat = db.query(ItemCategory).filter(ItemCategory.id == it.category_id).first()
            u = db.query(Unit).filter(Unit.id == it.unit_id).first()
            print(f"ID: {it.id} | Name: {it.item_name} | Category: {cat.category_name if cat else 'N/A'} | Unit: {u.unit_code if u else 'N/A'} | Status: {it.status}")
    finally:
        db.close()

if __name__ == "__main__":
    list_items()

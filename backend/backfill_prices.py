import sys
import os
from sqlalchemy.orm import Session
from datetime import datetime

# Add the backend directory to sys.path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from app.db.session import SessionLocal
from app.db.models import PurchaseItem, ItemPrice, Item

def backfill():
    db = SessionLocal()
    try:
        print("Starting backfill of ItemPrice table...")
        
        # 1. Backfill from PurchaseItem
        purchases = db.query(PurchaseItem).order_by(PurchaseItem.created_at.asc()).all()
        count = 0
        for p in purchases:
            # Check if this exact price for this item is already in ItemPrice
            # To keep it simple and follow the "unique" rule, we can just check if it's the latest price recorded
            latest = db.query(ItemPrice).filter(ItemPrice.item_id == p.item_id).order_by(ItemPrice.created_at.desc()).first()
            
            if not latest or round(float(latest.price), 2) != round(float(p.price), 2):
                db.add(ItemPrice(
                    item_id=p.item_id,
                    price=p.price,
                    purchase_entry_id=p.purchase_entry_id,
                    created_at=p.created_at,
                    created_by=p.created_by
                ))
                count += 1
        
        # 2. Backfill from Item default_price (if not already covered)
        items = db.query(Item).all()
        item_count = 0
        for item in items:
            if item.default_price and item.default_price > 0:
                # Check if any price exists
                exists = db.query(ItemPrice).filter(ItemPrice.item_id == item.id).first()
                if not exists:
                    db.add(ItemPrice(
                        item_id=item.id,
                        price=item.default_price,
                        created_at=item.created_at,
                        created_by=item.created_by
                    ))
                    item_count += 1

        db.commit()
        print(f"Successfully backfilled {count} records from purchases and {item_count} from items master.")
        
    except Exception as e:
        print(f"Error during backfill: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    backfill()

import sys
import os
from datetime import datetime, timezone

# Add the project root to sys.path to allow imports from app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from app.db.models import ItemType, ItemCategory, User
from app.db.session import SessionLocal

KITCHEN_CATEGORIES = [
    ("ಧಾನ್ಯಗಳು", "Grains"),
    ("ಬೇಳೆಕಾಳುಗಳು", "Pulses & Lentils"),
    ("ಎಣ್ಣೆ ಮತ್ತು ತುಪ್ಪ", "Oils & Ghee"),
    ("ತರಕಾರಿಗಳು", "Vegetables"),
    ("ಹಸಿರು ತರಕಾರಿಗಳು", "Leafy Vegetables"),
    ("ಹಾಲಿನ ಪದಾರ್ಥಗಳು", "Dairy Products"),
    ("ಮಸಾಲೆ ಪದಾರ್ಥಗಳು", "Spices & Masalas"),
    ("ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು", "Sambar Ingredients"),
    ("ಸಿಹಿ ಪದಾರ್ಥಗಳು", "Sweet Items"),
    ("ಹಣ್ಣುಗಳು", "Fruits"),
    ("ಪಾನೀಯಗಳು", "Beverages"),
    ("ಇಂಧನ ಸಾಮಗ್ರಿಗಳು", "Fuel Items"),
    ("ಸಾಮಾನ್ಯ ಸಾಮಗ್ರಿಗಳು", "General Kitchen Items"),
]

def seed_categories(db: Session):
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        print("Admin user not found. Please run seed.py first.")
        return
    admin_id = admin.id
    
    # Ensure "Kitchen" ItemType exists
    kitchen_type = db.query(ItemType).filter(ItemType.type_name == "Kitchen").first()
    if not kitchen_type:
        kitchen_type = ItemType(
            type_name="Kitchen",
            status=1,
            created_by=admin_id,
            updated_by=admin_id
        )
        db.add(kitchen_type)
        db.flush()
        print("Created 'Kitchen' item type.")
    
    now = datetime.now(timezone.utc)
    
    for kn, en in KITCHEN_CATEGORIES:
        category_name = f"{kn} ({en})"
        exists = db.query(ItemCategory).filter(
            ItemCategory.category_name == category_name,
            ItemCategory.type_id == kitchen_type.id
        ).first()
        
        if not exists:
            category = ItemCategory(
                type_id=kitchen_type.id,
                category_name=category_name,
                status=1,
                created_at=now,
                updated_at=now,
                created_by=admin_id,
                updated_by=admin_id
            )
            db.add(category)
            print(f"Added category: {category_name}")
        else:
            print(f"Category already exists: {category_name}")
            
    db.commit()

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_categories(db)
        print("Kitchen categories seeded successfully!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding categories: {e}")
    finally:
        db.close()

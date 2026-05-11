
import sys
import os
from datetime import datetime, timezone
from sqlalchemy.orm import Session

# Ensure the app module can be found
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.db.models import ItemType, ItemCategory, User
from app.db.session import SessionLocal

def seed_categories(db: Session):
    # 1. Get Admin User for Audit
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        print("Error: Please run 'python -m app.seed' first to create the admin user.")
        return
    admin_id = admin.id
    now = datetime.now(timezone.utc)

    print("--- Seeding Item Types (ಕನ್ನಡ) ---")
    types_data = [
        "ದಿನಸಿ",        # Grocery
        "ತರಕಾರಿಗಳು",    # Vegetables
        "ಹಾಲಿನ ಉತ್ಪನ್ನಗಳು" # Dairy
    ]
    type_map = {}
    for t_name in types_data:
        it = db.query(ItemType).filter(ItemType.type_name == t_name).first()
        if not it:
            it = ItemType(
                type_name=t_name, status=1, 
                created_at=now, updated_at=now, created_by=admin_id
            )
            db.add(it)
            db.flush()
            print(f"Added Type: {t_name}")
        else:
            print(f"Type already exists: {t_name}")
        type_map[t_name] = it.id

    print("\n--- Seeding Item Categories (ಕನ್ನಡ) ---")
    categories_data = [
        ("ಧಾನ್ಯಗಳು", "ದಿನಸಿ"),                # Grains
        ("ಬೇಳೆಕಾಳುಗಳು", "ದಿನಸಿ"),            # Pulses
        ("ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು", "ದಿನಸಿ"),       # Spices
        ("ಸಿಹಿ ಪದಾರ್ಥಗಳು", "ದಿನಸಿ"),          # Sweeteners
        ("ಎಣ್ಣೆ ಮತ್ತು ತುಪ್ಪ", "ದಿನಸಿ"),       # Oils & Ghee
        ("ಪಾನೀಯಗಳು", "ದಿನಸಿ"),               # Beverages
        ("ಸಾಮಾನ್ಯ ಸಾಮಗ್ರಿಗಳು", "ದಿನಸಿ"),      # General
        ("ಹಸಿರು ತರಕಾರಿಗಳು", "ತರಕಾರಿಗಳು"),     # Green Veg
        ("ಹಾಲಿನ ಪದಾರ್ಥಗಳು", "ಹಾಲಿನ ಉತ್ಪನ್ನಗಳು") # Dairy products
    ]
    
    for c_name, t_name in categories_data:
        cat = db.query(ItemCategory).filter(
            ItemCategory.category_name == c_name,
            ItemCategory.type_id == type_map[t_name]
        ).first()
        if not cat:
            cat = ItemCategory(
                category_name=c_name, 
                type_id=type_map[t_name], 
                status=1, created_at=now, updated_at=now, created_by=admin_id
            )
            db.add(cat)
            db.flush()
            print(f"Added Category: {c_name} under {t_name}")
        else:
            print(f"Category already exists: {c_name}")

    db.commit()
    print("\nSUCCESS: Kannada categories seeded with UTF-8 encoding.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_categories(db)
    finally:
        db.close()

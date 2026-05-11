
import sys
import os
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session

# Ensure the app module can be found
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.db.models import (
    Unit, ItemCategory, Item, MenuItem, User
)
from app.db.session import SessionLocal

def seed_items_and_dishes(db: Session):
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        print("Error: Please run 'python -m app.seed' first.")
        return
    admin_id = admin.id
    now = datetime.now(timezone.utc)

    # 1. Units
    print("--- Checking Units ---")
    units_data = [
        ("ಕಿಲೋ ಗ್ರಾಂ", "KG"), 
        ("ಲೀಟರ್", "LTR"), 
        ("ಪ್ಯಾಕೆಟ್", "PKT"), 
        ("ಸಂಖ್ಯೆ", "NOS"), 
        ("ಗ್ರಾಂ", "GM")
    ]
    unit_map = {}
    for name, code in units_data:
        u = db.query(Unit).filter(Unit.unit_code == code).first()
        if not u:
            u = Unit(unit_name=name, unit_code=code, status=1, created_at=now, updated_at=now, created_by=admin_id)
            db.add(u)
            db.flush()
        unit_map[code] = u.id

    # 2. Category Map
    cat_map = {c.category_name: c.id for c in db.query(ItemCategory).all()}

    # 3. Inventory Items (ಸಾಮಗ್ರಿ)
    print("\n--- Seeding Inventory Items ---")
    inventory_items = [
        ("ಅಕ್ಕಿ (Rice)", "ಧಾನ್ಯಗಳು", "KG", 55.00),
        ("ಸಕ್ಕರೆ (Sugar)", "ಸಿಹಿ ಪದಾರ್ಥಗಳು", "KG", 45.00),
        ("ಬೆಲ್ಲ (Jaggery)", "ಸಿಹಿ ಪದಾರ್ಥಗಳು", "KG", 60.00),
        ("ತೊಗರಿ ಬೇಳೆ (Toor Dal)", "ಬೇಳೆಕಾಳುಗಳು", "KG", 160.00),
        ("ಉದ್ದಿನ ಬೇಳೆ (Urad Dal)", "ಬೇಳೆಕಾಳುಗಳು", "KG", 140.00),
        ("ಕಡಲೆ ಬೇಳೆ (Chana Dal)", "ಬೇಳೆಕಾಳುಗಳು", "KG", 90.00),
        ("ಅಡುಗೆ ಎಣ್ಣೆ (Cooking Oil)", "ಎಣ್ಣೆ ಮತ್ತು ತುಪ್ಪ", "LTR", 130.00),
        ("ತುಪ್ಪ (Ghee)", "ಎಣ್ಣೆ ಮತ್ತು ತುಪ್ಪ", "KG", 650.00),
        ("ಜೀರಿಗೆ (Jeera)", "ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು", "KG", 350.00),
        ("ಸಾಸಿವೆ (Mustard)", "ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು", "KG", 90.00),
        ("ಅರಿಶಿಣ ಪುಡಿ (Turmeric)", "ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು", "PKT", 20.00),
        ("ಕೆಂಪು ಮೆಣಸಿನಕಾಯಿ (Red Chilly)", "ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು", "KG", 280.00),
        ("ಧನಿಯಾ (Coriander Seeds)", "ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು", "KG", 120.00),
        ("ಏಲಕ್ಕಿ (Cardamom)", "ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು", "KG", 2800.00),
        ("ಲವಂಗ (Cloves)", "ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು", "KG", 950.00),
        ("ಮೆಂತೆ (Methi)", "ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು", "KG", 110.00),
        ("ಉಪ್ಪು (Salt)", "ಸಾಮಾನ್ಯ ಸಾಮಗ್ರಿಗಳು", "PKT", 25.00),
        ("ಹುಣಸೆ ಹಣ್ಣು (Tamarind)", "ಸಾಮಾನ್ಯ ಸಾಮಗ್ರಿಗಳು", "KG", 180.00),
        ("ಗೋಧಿ ಕಡಿ (Wheat Rava)", "ಧಾನ್ಯಗಳು", "KG", 45.00),
        ("ಅವಲಕ್ಕಿ (Avalaki)", "ಧಾನ್ಯಗಳು", "KG", 60.00),
    ]

    for name, c_name, u_code, price in inventory_items:
        if c_name not in cat_map:
            print(f"Warning: Category {c_name} not found. Skipping {name}")
            continue
        it = db.query(Item).filter(Item.item_name == name).first()
        if not it:
            it = Item(
                item_name=name,
                category_id=cat_map[c_name],
                unit_id=unit_map[u_code],
                default_price=Decimal(str(price)),
                opening_stock=Decimal("0.00"),
                current_stock=Decimal("0.00"),
                status=1, created_at=now, updated_at=now, created_by=admin_id
            )
            db.add(it)
            print(f"Added Item: {name}")

    # 4. Menu Items (Dishes - ಅಡುಗೆಗಳು)
    print("\n--- Seeding Menu Items (Dishes) ---")
    menu_items = [
        ("ಅನ್ನ (Rice)", "NOS"),
        ("ಸಾರು (Rasam)", "NOS"),
        ("ಪಾಯಸ (Payasam)", "NOS"),
        ("ಹುಳಿ (Huli)", "NOS"),
        ("ಪಲ್ಯ (Palya)", "NOS"),
        ("ಚಟ್ನಿ (Chatni)", "NOS"),
        ("ಮಜ್ಜಿಗೆ (Buttermilk)", "NOS"),
        ("ಚಿತ್ರಾನ್ನ (Chitranna)", "NOS"),
        ("ಕೋಸಂಬರಿ (Kosambari)", "NOS")
    ]
    for name, u_code in menu_items:
        mi = db.query(MenuItem).filter(MenuItem.dish_name == name).first()
        if not mi:
            mi = MenuItem(
                dish_name=name,
                unit_id=unit_map[u_code],
                status=1, created_at=now, updated_at=now, created_by=admin_id
            )
            db.add(mi)
            print(f"Added Dish: {name}")

    db.commit()
    print("\nSUCCESS: Kannada items and dishes seeded.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_items_and_dishes(db)
    finally:
        db.close()

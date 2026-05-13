from app.db.session import SessionLocal
from app.db.models import Item, ItemCategory, Unit, User
from decimal import Decimal
from datetime import datetime, timezone

# Mapping of Item Name -> Category Name
ITEM_CATEGORY_MAPPING = {
    "ಅಕ್ಕಿ (Rice)": "ಧಾನ್ಯಗಳು (Grains)",
    "ಬೆಲ್ಲ (Jaggery)": "ಸಿಹಿ ಪದಾರ್ಥಗಳು (Sweet Items)",
    "ತೊಗರಿ ಬೇಳೆ (Toor Dal)": "ಬೇಳೆಕಾಳುಗಳು (Pulses & Lentils)",
    "ಗೋಧಿ ಕಡಿ (Wheat Rava)": "ಧಾನ್ಯಗಳು (Grains)",
    "ಒಣಮೆಣಸು (Dry Chilli)": "ಮಸಾಲೆ ಪದಾರ್ಥಗಳು (Spices & Masalas)",
    "ಹುಣಸೆ ಹಣ್ಣು (Tamarind)": "ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು (Sambar Ingredients)",
    "ತುಪ್ಪ (Ghee)": "ಎಣ್ಣೆ ಮತ್ತು ತುಪ್ಪ (Oils & Ghee)",
    "ಉಪ್ಪು (Salt)": "ಸಾಮಾನ್ಯ ಸಾಮಗ್ರಿಗಳು (General Kitchen Items)",
    "ಕೆಂಪು ಮೆಣಸಿನಕಾಯಿ (Red Chilly)": "ಮಸಾಲೆ ಪದಾರ್ಥಗಳು (Spices & Masalas)",
    "ಅಡುಗೆ ಎಣ್ಣೆ (Cooking Oil)": "ಎಣ್ಣೆ ಮತ್ತು ತುಪ್ಪ (Oils & Ghee)",
    "ಅರಿಶಿಣ ಪುಡಿ (Turmeric Powder)": "ಮಸಾಲೆ ಪದಾರ್ಥಗಳು (Spices & Masalas)",
    "ಅವಲಕ್ಕಿ (Avalakki)": "ಧಾನ್ಯಗಳು (Grains)",
    "ಉದ್ದಿನ ಬೇಳೆ (Urad Dal)": "ಬೇಳೆಕಾಳುಗಳು (Pulses & Lentils)",
    "ಏಲಕ್ಕಿ (Cardamom)": "ಮಸಾಲೆ ಪದಾರ್ಥಗಳು (Spices & Masalas)",
    "ಕಡಲೆ ಬೇಳೆ (Chana Dal)": "ಬೇಳೆಕಾಳುಗಳು (Pulses & Lentils)",
    "ಕಾಫಿ ಪುಡಿ (Coffee Powder)": "ಪಾನೀಯಗಳು (Beverages)",
    "ಚಹಾ ಪುಡಿ (Tea Powder)": "ಪಾನೀಯಗಳು (Beverages)",
    "ಜೀರಿಗೆ (Jeera)": "ಮಸಾಲೆ ಪದಾರ್ಥಗಳು (Spices & Masalas)",
    "ಧನಿಯಾ (Coriander Seeds)": "ಮಸಾಲೆ ಪದಾರ್ಥಗಳು (Spices & Masalas)",
    "ಮೆಂತೆ (Methi)": "ಮಸಾಲೆ ಪದಾರ್ಥಗಳು (Spices & Masalas)",
    "ಲವಂಗ (Cloves)": "ಮಸಾಲೆ ಪದಾರ್ಥಗಳು (Spices & Masalas)",
    "ಸಕ್ಕರೆ (Sugar)": "ಸಿಹಿ ಪದಾರ್ಥಗಳು (Sweet Items)",
    "ಸಾಸಿವೆ (Mustard)": "ಮಸಾಲೆ ಪದಾರ್ಥಗಳು (Spices & Masalas)",
    "ಹಿಂಗು (Hing)": "ಮಸಾಲೆ ಪದಾರ್ಥಗಳು (Spices & Masalas)",
    "ಟೊಮೇಟೊ (Tomato)": "ತರಕಾರಿಗಳು (Vegetables)",
    "ಆಲೂಗಡ್ಡೆ (Potato)": "ತರಕಾರಿಗಳು (Vegetables)",
    "ಕ್ಯಾರೆಟ್ (Carrot)": "ತರಕಾರಿಗಳು (Vegetables)",
    "ಬೀನ್ಸ್ (Beans)": "ತರಕಾರಿಗಳು (Vegetables)",
    "ಸೌತೆಕಾಯಿ (Cucumber)": "ತರಕಾರಿಗಳು (Vegetables)",
    "ಹಸಿಮೆಣಸಿನಕಾಯಿ (Green Chilli)": "ತರಕಾರಿಗಳು (Vegetables)",
    "ಕುಂಬಳಕಾಯಿ (Pumpkin)": "ತರಕಾರಿಗಳು (Vegetables)",
    "ಕೊತ್ತಂಬರಿ ಸೊಪ್ಪು (Coriander Leaves)": "ಹಸಿರು ತರಕಾರಿಗಳು (Leafy Vegetables)",
    "ಕರಿಬೇವು (Curry Leaves)": "ಹಸಿರು ತರಕಾರಿಗಳು (Leafy Vegetables)",
    "ಶುಂಠಿ (Ginger)": "ಮಸಾಲೆ ಪದಾರ್ಥಗಳು (Spices & Masalas)",
    "ಮೆಣಸು (Pepper)": "ಮಸಾಲೆ ಪದಾರ್ಥಗಳು (Spices & Masalas)",
    "ತೆಂಗಿನಕಾಯಿ (Coconut)": "ಹಣ್ಣುಗಳು (Fruits)",
    "ಬಾಳೆಹಣ್ಣು (Banana)": "ಹಣ್ಣುಗಳು (Fruits)",
    "ಹಾಲು (Milk)": "ಹಾಲಿನ ಪದಾರ್ಥಗಳು (Dairy Products)",
    "ಮೊಸರು (Curd)": "ಹಾಲಿನ ಪದಾರ್ಥಗಳು (Dairy Products)",
    "ಗ್ಯಾಸ್ (Gas)": "ಇಂಧನ ಸಾಮಗ್ರಿಗಳು (Fuel Items)",
    "ಇಂಧನ ಮರ (Firewood)": "ಇಂಧನ ಸಾಮಗ್ರಿಗಳು (Fuel Items)",
}

# New items with their units
NEW_ITEMS = [
    ("ಆಲೂಗಡ್ಡೆ (Potato)", "ತರಕಾರಿಗಳು (Vegetables)", "kg"),
    ("ಕ್ಯಾರೆಟ್ (Carrot)", "ತರಕಾರಿಗಳು (Vegetables)", "kg"),
    ("ಬೀನ್ಸ್ (Beans)", "ತರಕಾರಿಗಳು (Vegetables)", "kg"),
    ("ಸೌತೆಕಾಯಿ (Cucumber)", "ತರಕಾರಿಗಳು (Vegetables)", "kg"),
    ("ಹಸಿಮೆಣಸಿನಕಾಯಿ (Green Chilli)", "ತರಕಾರಿಗಳು (Vegetables)", "kg"),
    ("ಕುಂಬಳಕಾಯಿ (Pumpkin)", "ತರಕಾರಿಗಳು (Vegetables)", "kg"),
    ("ಕೊತ್ತಂಬರಿ ಸೊಪ್ಪು (Coriander Leaves)", "ಹಸಿರು ತರಕಾರಿಗಳು (Leafy Vegetables)", "kg"),
    ("ಕರಿಬೇವು (Curry Leaves)", "ಹಸಿರು ತರಕಾರಿಗಳು (Leafy Vegetables)", "kg"),
    ("ಶುಂಠಿ (Ginger)", "ಮಸಾಲೆ ಪದಾರ್ಥಗಳು (Spices & Masalas)", "kg"),
    ("ಮೆಣಸು (Pepper)", "ಮಸಾಲೆ ಪದಾರ್ಥಗಳು (Spices & Masalas)", "kg"),
    ("ತೆಂಗಿನಕಾಯಿ (Coconut)", "ಹಣ್ಣುಗಳು (Fruits)", "nos"),
    ("ಬಾಳೆಹಣ್ಣು (Banana)", "ಹಣ್ಣುಗಳು (Fruits)", "nos"),
    ("ಹಾಲು (Milk)", "ಹಾಲಿನ ಪದಾರ್ಥಗಳು (Dairy Products)", "ltr"),
    ("ಮೊಸರು (Curd)", "ಹಾಲಿನ ಪದಾರ್ಥಗಳು (Dairy Products)", "ltr"),
    ("ಗ್ಯಾಸ್ (Gas)", "ಇಂಧನ ಸಾಮಗ್ರಿಗಳು (Fuel Items)", "nos"),
    ("ಇಂಧನ ಮರ (Firewood)", "ಇಂಧನ ಸಾಮಗ್ರಿಗಳು (Fuel Items)", "kg"),
]

def run_setup():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        admin_id = admin.id if admin else 1
        now = datetime.now(timezone.utc)

        # 1. Rename existing inconsistent items
        tomato = db.query(Item).filter(Item.item_name == "tomato").first()
        if tomato:
            tomato.item_name = "ಟೊಮೇಟೊ (Tomato)"
            print("Renamed 'tomato' to 'ಟೊಮೇಟೊ (Tomato)'")

        jaggery_wrong = db.query(Item).filter(Item.item_name == "ಬೆಲ್ಲ (Jaggery").first()
        if jaggery_wrong:
            jaggery_wrong.item_name = "ಬೆಲ್ಲ (Jaggery)"
            print("Fixed spelling for 'ಬೆಲ್ಲ (Jaggery)'")

        # 2. Create New Items
        for name, cat_name, unit_code in NEW_ITEMS:
            exists = db.query(Item).filter(Item.item_name == name).first()
            if not exists:
                cat = db.query(ItemCategory).filter(ItemCategory.category_name == cat_name).first()
                unit = db.query(Unit).filter(Unit.unit_code == unit_code).first()
                
                if cat and unit:
                    new_item = Item(
                        item_name=name,
                        category_id=cat.id,
                        unit_id=unit.id,
                        opening_stock=Decimal("0.00"),
                        current_stock=Decimal("0.00"),
                        status=1,
                        created_at=now,
                        updated_at=now,
                        created_by=admin_id,
                        updated_by=admin_id
                    )
                    db.add(new_item)
                    print(f"Created new item: {name}")
                else:
                    print(f"Could not create '{name}': Category '{cat_name}' or Unit '{unit_code}' not found.")

        db.flush()

        # 3. Update Category Links for ALL items
        all_items = db.query(Item).all()
        for item in all_items:
            if item.item_name in ITEM_CATEGORY_MAPPING:
                target_cat_name = ITEM_CATEGORY_MAPPING[item.item_name]
                target_cat = db.query(ItemCategory).filter(ItemCategory.category_name == target_cat_name).first()
                if target_cat:
                    item.category_id = target_cat.id
                    print(f"Linked '{item.item_name}' to category '{target_cat_name}'")
                else:
                    print(f"Target category '{target_cat_name}' not found for item '{item.item_name}'")

        db.commit()
        print("Final item and category setup completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"Error during setup: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_setup()

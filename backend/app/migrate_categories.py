from app.db.session import SessionLocal
from app.db.models import ItemCategory, Item

MAPPING = {
    "ಧಾನ್ಯಗಳು": "ಧಾನ್ಯಗಳು (Grains)",
    "ಬೇಳೆಕಾಳುಗಳು": "ಬೇಳೆಕಾಳುಗಳು (Pulses & Lentils)",
    "ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು": "ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು (Sambar Ingredients)",
    "ಸಿಹಿ ಪದಾರ್ಥಗಳು": "ಸಿಹಿ ಪದಾರ್ಥಗಳು (Sweet Items)",
    "ಎಣ್ಣೆ ಮತ್ತು ತುಪ್ಪ": "ಎಣ್ಣೆ ಮತ್ತು ತುಪ್ಪ (Oils & Ghee)",
    "ಹಸಿರು ತರಕಾರಿಗಳು": "ಹಸಿರು ತರಕಾರಿಗಳು (Leafy Vegetables)",
    "ಸಾಮಾನ್ಯ ಸಾಮಗ್ರಿಗಳು": "ಸಾಮಾನ್ಯ ಸಾಮಗ್ರಿಗಳು (General Kitchen Items)",
    "ಪಾನೀಯಗಳು": "ಪಾನೀಯಗಳು (Beverages)",
    "ಹಾಲಿನ ಪದಾರ್ಥಗಳು": "ಹಾಲಿನ ಪದಾರ್ಥಗಳು (Dairy Products)",
}

def migrate_and_cleanup():
    db = SessionLocal()
    try:
        # 1. Migrate items from old categories to new ones
        for old_name, new_name in MAPPING.items():
            old_cat = db.query(ItemCategory).filter(ItemCategory.category_name == old_name).first()
            new_cat = db.query(ItemCategory).filter(ItemCategory.category_name == new_name).first()
            
            if old_cat and new_cat:
                items = db.query(Item).filter(Item.category_id == old_cat.id).all()
                for item in items:
                    item.category_id = new_cat.id
                    print(f"Migrated item '{item.item_name}' from '{old_name}' to '{new_name}'")
                
                # Deactivate old category
                old_cat.status = 0
                print(f"Deactivated old category: {old_name}")
        
        # 2. Cleanup other unused categories
        others = ["testingg", "vegitables"]
        for name in others:
            cat = db.query(ItemCategory).filter(ItemCategory.category_name == name).first()
            if cat:
                count = db.query(Item).filter(Item.category_id == cat.id).count()
                if count == 0:
                    cat.status = 0
                    print(f"Deactivated unused category: {name}")

        db.commit()
        print("Migration and cleanup completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error during migration: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate_and_cleanup()

from app.db.session import SessionLocal
from app.db.models import ItemCategory, Item

def delete_redundant_categories():
    db = SessionLocal()
    try:
        # List of old Kannada-only categories to be removed
        to_delete = [
            "ಎಣ್ಣೆ ಮತ್ತು ತುಪ್ಪ",
            "ಧಾನ್ಯಗಳು",
            "ಪಾನೀಯಗಳು",
            "ಬೇಳೆಕಾಳುಗಳು",
            "ಸಾಂಬಾರ ಪದಾರ್ಥಗಳು",
            "ಸಾಮಾನ್ಯ ಸಾಮಗ್ರಿಗಳು",
            "ಸಿಹಿ ಪದಾರ್ಥಗಳು",
            "ಹಸಿರು ತರಕಾರಿಗಳು",
            "ಹಾಲಿನ ಪದಾರ್ಥಗಳು"
        ]
        
        for name in to_delete:
            # We search specifically for the exact Kannada name (without the English part in brackets)
            cat = db.query(ItemCategory).filter(ItemCategory.category_name == name).first()
            if cat:
                # Safety check: ensure no items are linked
                count = db.query(Item).filter(Item.category_id == cat.id).count()
                if count == 0:
                    db.delete(cat)
                    print(f"Deleted redundant category: {name}")
                else:
                    print(f"Cannot delete category '{name}': It still has {count} items linked. (Skipping)")
            else:
                print(f"Category not found or already deleted: {name}")
        
        db.commit()
        print("Redundant category cleanup completed.")
    except Exception as e:
        db.rollback()
        print(f"Error during deletion: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    delete_redundant_categories()

from app.db.session import SessionLocal
from app.db.models import ItemCategory, Item

def delete_obsolete_categories():
    db = SessionLocal()
    try:
        to_delete = ["testingg", "vegitables"]
        for name in to_delete:
            cat = db.query(ItemCategory).filter(ItemCategory.category_name == name).first()
            if cat:
                # Check usage one last time for safety
                count = db.query(Item).filter(Item.category_id == cat.id).count()
                if count == 0:
                    db.delete(cat)
                    print(f"Deleted category: {name}")
                else:
                    print(f"Cannot delete category '{name}': It has {count} items linked.")
            else:
                print(f"Category not found: {name}")
        
        db.commit()
        print("Cleanup completed.")
    except Exception as e:
        db.rollback()
        print(f"Error during deletion: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    delete_obsolete_categories()

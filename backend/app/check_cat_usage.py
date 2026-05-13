from app.db.session import SessionLocal
from app.db.models import ItemCategory, Item

def check_usage():
    db = SessionLocal()
    try:
        categories = db.query(ItemCategory).all()
        print(f"{'Category Name':<40} | {'Usage Count':<12}")
        print("-" * 55)
        for c in categories:
            count = db.query(Item).filter(Item.category_id == c.id).count()
            print(f"{c.category_name:<40} | {count:<12}")
    finally:
        db.close()

if __name__ == "__main__":
    check_usage()

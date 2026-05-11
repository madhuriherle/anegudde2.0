
import sys
import os
from sqlalchemy.orm import Session

# Ensure the app module can be found
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.db.session import SessionLocal
from app.services.item_service import list_items

def test_search():
    db = SessionLocal()
    try:
        # Test with q='rice'
        result = list_items(db, page=1, page_size=20, q="rice", status=1)
        print(f"Search for 'rice' returned {len(result['items'])} items. Total count: {result['total']}")
        for it in result['items']:
            print(f"Found: {it.item_name}")

        # Test with q='Rice'
        result = list_items(db, page=1, page_size=20, q="Rice", status=1)
        print(f"Search for 'Rice' returned {len(result['items'])} items. Total count: {result['total']}")

        # Test with no q
        result = list_items(db, page=1, page_size=20, q=None, status=1)
        print(f"Search with no q returned {len(result['items'])} items. Total count: {result['total']}")

    finally:
        db.close()

if __name__ == "__main__":
    test_search()

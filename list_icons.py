import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.session import SessionLocal
from app.db.models import Module

def list_icons():
    db = SessionLocal()
    try:
        modules = db.query(Module).filter(Module.icon != None).all()
        print(f"{'ID':<4} | {'Name':<30} | {'Icon':<20} | {'Parent ID':<10}")
        print("-" * 75)
        for m in modules:
            print(f"{m.id:<4} | {m.name:<30} | {m.icon:<20} | {m.parent_id or 'Root':<10}")
    finally:
        db.close()

if __name__ == "__main__":
    list_icons()

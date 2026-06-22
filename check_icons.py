import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.session import SessionLocal
from app.db.models import Module

def check_icons():
    db = SessionLocal()
    try:
        modules = db.query(Module).all()
        print(f"{'ID':<4} | {'Name':<30} | {'Icon':<20}")
        print("-" * 60)
        for m in modules:
            print(f"{m.id:<4} | {m.name:<30} | {m.icon or 'None':<20}")
    finally:
        db.close()

if __name__ == "__main__":
    check_icons()

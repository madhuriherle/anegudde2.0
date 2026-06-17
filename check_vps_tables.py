import sys
import os

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.session import SessionLocal
from sqlalchemy import inspect

def check_tables():
    db = SessionLocal()
    try:
        inspector = inspect(db.bind)
        tables = inspector.get_table_names()
        print("--- Tables in Database ---")
        for t in sorted(tables):
            print(t)
        
        if 'printer_configs' in tables:
            print("\nprinter_configs table exists.")
        else:
            print("\nprinter_configs table MISSING.")
    finally:
        db.close()

if __name__ == "__main__":
    check_tables()

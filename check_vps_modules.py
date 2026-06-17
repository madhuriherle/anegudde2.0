import sys
import os

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.session import SessionLocal
from app.db.models import Module, Privilege

def check_modules():
    db = SessionLocal()
    try:
        modules = db.query(Module).all()
        print("--- Modules in Database ---")
        for m in modules:
            print(f"ID: {m.id}, Name: {m.name}, Route: {m.route}")
        
        print("\n--- Privileges in Database ---")
        privs = db.query(Privilege).all()
        for p in privs:
            print(f"ID: {p.id}, Name: {p.privilege_name}, Module ID: {p.module_id}")
    finally:
        db.close()

if __name__ == "__main__":
    check_modules()

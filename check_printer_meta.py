import sys
import os

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.session import SessionLocal
from app.db.models import Module, Privilege

def check_printer_module():
    db = SessionLocal()
    try:
        m = db.query(Module).filter(Module.name.ilike("%Printer%")).all()
        print("--- Printer Related Modules ---")
        for mod in m:
            print(f"ID: {mod.id}, Name: {mod.name}, Route: {mod.route}")
        
        p = db.query(Privilege).filter(Privilege.privilege_name.ilike("%printer%")).all()
        print("\n--- Printer Related Privileges ---")
        for priv in p:
            print(f"ID: {priv.id}, Name: {priv.privilege_name}, Module ID: {priv.module_id}")
    finally:
        db.close()

if __name__ == "__main__":
    check_printer_module()

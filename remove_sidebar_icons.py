import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.session import SessionLocal
from app.db.models import Module

def remove_icon():
    db = SessionLocal()
    try:
        # Find Printer Settings module and remove its icon
        printer_mod = db.query(Module).filter(Module.name == 'Printer Settings').first()
        if printer_mod:
            print(f"Found Printer Settings (ID: {printer_mod.id}). Current icon: {printer_mod.icon}")
            printer_mod.icon = None
            db.commit()
            print("Icon removed successfully.")
        else:
            print("Printer Settings module not found.")
            
        # Also check Role Management as it was in the fix script before
        role_mod = db.query(Module).filter(Module.name == 'Role Management').first()
        if role_mod and role_mod.icon:
            print(f"Found Role Management (ID: {role_mod.id}). Current icon: {role_mod.icon}")
            role_mod.icon = None
            db.commit()
            print("Icon removed from Role Management.")
            
    finally:
        db.close()

if __name__ == "__main__":
    remove_icon()

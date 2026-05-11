
import sys
import os
from datetime import datetime, timezone
from sqlalchemy.orm import Session

# Ensure the app module can be found
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.db.models import Unit, User
from app.db.session import SessionLocal

def update_units(db: Session):
    admin = db.query(User).filter(User.username == "admin").first()
    admin_id = admin.id if admin else None
    now = datetime.now(timezone.utc)

    # 1. Define the bulk units for temple operations (lowercase)
    # (unit_code, unit_name)
    bulk_units = [
        ("kg", "kilogram"),
        ("ltr", "litre"),
        ("pkt", "packet"),
        ("nos", "number"),
        ("bag", "bag (25/50kg)"),
        ("tin", "tin (15kg/ltr)"),
        ("ctn", "carton/box"),
        ("bdl", "bundle"),
        ("quintal", "quintal (100kg)"),
        ("pcs", "pieces")
    ]

    print("--- Updating/Adding Bulk Units ---")
    
    for code, name in bulk_units:
        # Check if unit with this code exists (case-insensitive check)
        existing = db.query(Unit).filter(Unit.unit_code.ilike(code)).first()
        
        if existing:
            # Update existing to lowercase English
            existing.unit_code = code
            existing.unit_name = name
            print(f"Updated: {code}")
        else:
            # Add new bulk unit
            new_unit = Unit(
                unit_name=name,
                unit_code=code,
                status=1,
                created_at=now,
                updated_at=now,
                created_by=admin_id
            )
            db.add(new_unit)
            print(f"Added: {code}")

    db.commit()
    print("\nSUCCESS: Bulk units standardized for temple use.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        update_units(db)
    finally:
        db.close()


import sys
import os
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session

# Ensure the app module can be found
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.db.models import Vendor, User
from app.db.session import SessionLocal

def seed_vendor(db: Session):
    admin = db.query(User).filter(User.username == "admin").first()
    admin_id = admin.id if admin else None
    now = datetime.now(timezone.utc)

    # Details extracted from Invoice IMG_20260506_153139548~2.jpg
    vendor_details = {
        "vendor_name": "MAHAMAYA TRADERS",
        "vendor_code": "V-MAHAMAYA",
        "contact_number": "6364708055",
        "address_line1": "VII-99/A ANANTH KRIPA",
        "address_line2": "MAIN ROAD, KOTESHWARA",
        "city": "Koteshwara",
        "state": "Karnataka",
        "notes": "GSTIN: 29ABWFM2752J1ZI",
        "opening_balance": Decimal("0.00"),
        "status": 1
    }

    print(f"--- Seeding Vendor: {vendor_details['vendor_name']} ---")
    
    existing = db.query(Vendor).filter(Vendor.vendor_name == vendor_details['vendor_name']).first()
    
    if not existing:
        new_vendor = Vendor(
            vendor_name=vendor_details['vendor_name'],
            vendor_code=vendor_details['vendor_code'],
            contact_number=vendor_details['contact_number'],
            address_line1=vendor_details['address_line1'],
            address_line2=vendor_details['address_line2'],
            city=vendor_details['city'],
            state=vendor_details['state'],
            notes=vendor_details['notes'],
            opening_balance=vendor_details['opening_balance'],
            status=vendor_details['status'],
            created_at=now,
            updated_at=now,
            created_by=admin_id
        )
        db.add(new_vendor)
        db.commit()
        print("SUCCESS: Vendor details stored.")
    else:
        print("Vendor already exists in the database.")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_vendor(db)
    finally:
        db.close()

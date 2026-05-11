
import sys
import os
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session

# Ensure the app module can be found
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.db.models import Item, PurchaseEntry, PurchaseItem, User, Vendor
from app.db.session import SessionLocal
from app.services.purchase_service import create_purchase, update_purchase
from app.schemas.purchase import PurchaseEntryCreate, PurchaseEntryUpdate, PurchaseItemIn

def test_stock_update_flow():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        vendor = db.query(Vendor).first()
        rice = db.query(Item).filter(Item.id == 1).first()
        
        initial_stock = rice.current_stock
        print(f"Initial Rice Stock: {initial_stock}")

        # 1. Create a Purchase
        payload = PurchaseEntryCreate(
            vendor_id=vendor.id,
            purchase_date=date.today(),
            bill_no="TEST-001",
            invoice_amount=Decimal("1000.00"),
            items=[
                PurchaseItemIn(item_id=1, quantity=Decimal("10.00"), price=Decimal("100.00"))
            ],
            user_id=admin.id,
            status=1
        )
        
        print("\nCreating Purchase of 10kg...")
        new_p = create_purchase(payload, db, admin)
        db.refresh(rice)
        print(f"Rice Stock after create: {rice.current_stock}")

        # 2. Update the Purchase (change qty to 15)
        print("\nUpdating Purchase to 15kg...")
        update_payload = PurchaseEntryUpdate(
            vendor_id=vendor.id,
            purchase_date=date.today(),
            bill_no="TEST-001",
            invoice_amount=Decimal("1500.00"),
            items=[
                PurchaseItemIn(item_id=1, quantity=Decimal("15.00"), price=Decimal("100.00"))
            ],
            status=1
        )
        updated_p = update_purchase(new_p.id, update_payload, db, admin)
        db.refresh(rice)
        print(f"Rice Stock after update: {rice.current_stock}")

        # Expected Stock: initial + 15
        expected = initial_stock + Decimal("15.00")
        if rice.current_stock == expected:
            print("\nSUCCESS: Stock updated correctly in Item table.")
        else:
            print(f"\nFAILURE: Stock mismatch! Expected {expected}, got {rice.current_stock}")

    finally:
        db.close()

if __name__ == "__main__":
    test_stock_update_flow()

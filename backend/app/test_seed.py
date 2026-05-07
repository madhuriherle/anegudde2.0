from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from app.db.models import Vendor, Unit, ItemCategory, Item, User, PurchaseEntry, PurchaseItem, ConsumptionEntry, ConsumptionItem, StockLedger, VendorPayment
from app.db.session import SessionLocal

def seed_test_data(db: Session):
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        print("Admin user not found. Please run python -m app.seed first.")
        return

    admin_id = admin.id
    now = datetime.now(timezone.utc)
    today = date.today()

    # 1. Seed Units
    units_data = [
        {"unit_name": "Kilogram", "unit_code": "KG"},
        {"unit_name": "Litre", "unit_code": "LTR"},
        {"unit_name": "Packet", "unit_code": "PKT"},
        {"unit_name": "Number", "unit_code": "NOS"},
    ]
    unit_map = {}
    for u in units_data:
        unit = db.query(Unit).filter(Unit.unit_code == u["unit_code"]).first()
        if not unit:
            unit = Unit(**u, status=1, created_at=now, updated_at=now, created_by=admin_id, updated_by=admin_id)
            db.add(unit)
            db.flush()
        unit_map[u["unit_code"]] = unit.id

    # 2. Seed Categories
    categories = ["Groceries", "Vegetables", "Dairy", "Cleaning Supplies"]
    cat_map = {}
    for c_name in categories:
        cat = db.query(ItemCategory).filter(ItemCategory.category_name == c_name).first()
        if not cat:
            cat = ItemCategory(category_name=c_name, status=1, created_at=now, updated_at=now, created_by=admin_id, updated_by=admin_id)
            db.add(cat)
            db.flush()
        cat_map[c_name] = cat.id

    # 3. Seed Vendors
    vendors_data = [
        {
            "vendor_code": "V001",
            "vendor_name": "Sri Krishna Traders",
            "contact_number": "9876543210",
            "address_line1": "Main Road, Kota",
            "opening_balance": Decimal("0.00"),
            "current_balance": Decimal("0.00"),
        },
        {
            "vendor_code": "V002",
            "vendor_name": "Udupi Veg Supplies",
            "contact_number": "9123456789",
            "address_line1": "Market Area, Udupi",
            "opening_balance": Decimal("0.00"),
            "current_balance": Decimal("0.00"),
        }
    ]
    vendor_map = {}
    for v_data in vendors_data:
        vendor = db.query(Vendor).filter(Vendor.vendor_code == v_data["vendor_code"]).first()
        if not vendor:
            vendor = Vendor(**v_data, status=1, created_at=now, updated_at=now, created_by=admin_id, updated_by=admin_id)
            db.add(vendor)
            db.flush()
        vendor_map[v_data["vendor_code"]] = vendor.id

    # 4. Seed Items
    items_data = [
        {"item_name": "Rice (Sona Masuri)", "category": "Groceries", "unit": "KG", "opening_stock": 100, "default_price": 60},
        {"item_name": "Toor Dal", "category": "Groceries", "unit": "KG", "opening_stock": 50, "default_price": 160},
        {"item_name": "Coconut Oil", "category": "Groceries", "unit": "LTR", "opening_stock": 20, "default_price": 220},
        {"item_name": "Milk", "category": "Dairy", "unit": "LTR", "opening_stock": 10, "default_price": 50},
    ]
    item_map = {}
    for i_data in items_data:
        item = db.query(Item).filter(Item.item_name == i_data["item_name"]).first()
        if not item:
            item = Item(
                item_name=i_data["item_name"],
                category_id=cat_map[i_data["category"]],
                unit_id=unit_map[i_data["unit"]],
                opening_stock=Decimal(str(i_data["opening_stock"])),
                current_stock=Decimal(str(i_data["opening_stock"])),
                default_price=Decimal(str(i_data["default_price"])),
                status=1,
                created_at=now,
                updated_at=now,
                created_by=admin_id,
                updated_by=admin_id
            )
            db.add(item)
            db.flush()
        item_map[i_data["item_name"]] = item

    # 6. Seed Purchase Transactions
    # Check if a purchase exists to prevent duplicating transactions
    purchase = db.query(PurchaseEntry).first()
    if not purchase:
        p_entry = PurchaseEntry(
            vendor_id=vendor_map["V001"],
            purchase_date=today,
            bill_no="BILL-1001",
            total_amount=Decimal("1200.00"),
            user_id=admin_id,
            created_at=now,
            updated_at=now
        )
        db.add(p_entry)
        db.flush()

        rice_item = item_map["Rice (Sona Masuri)"]
        p_item = PurchaseItem(
            purchase_entry_id=p_entry.id,
            item_id=rice_item.id,
            quantity=Decimal("20.00"),
            price=Decimal("60.00"),
            line_total=Decimal("1200.00"),
            created_at=now,
            updated_at=now
        )
        db.add(p_item)

        # Update Stock & Ledger
        rice_item.current_stock += Decimal("20.00")
        ledger = StockLedger(
            item_id=rice_item.id,
            txn_date=today,
            txn_type=1, # Purchase
            ref_table="purchase_entries",
            ref_id=p_entry.id,
            qty_in=Decimal("20.00"),
            unit_cost=Decimal("60.00"),
            value_in=Decimal("1200.00"),
            balance=rice_item.current_stock,
            created_at=now,
            updated_at=now
        )
        db.add(ledger)

        # Vendor Payment
        payment = VendorPayment(
            vendor_id=vendor_map["V001"],
            payment_date=today,
            amount=Decimal("1200.00"),
            payment_mode="Cash",
            reference_no="CASH-1",
            user_id=admin_id,
            created_at=now,
            updated_at=now
        )
        db.add(payment)

    # 7. Seed Consumption Transactions
    consumption = db.query(ConsumptionEntry).first()
    if not consumption:
        c_entry = ConsumptionEntry(
            usage_date=today,
            people_served=500,
            chef_id=chef.id,
            user_id=admin_id,
            created_at=now,
            updated_at=now
        )
        db.add(c_entry)
        db.flush()

        dal_item = item_map["Toor Dal"]
        c_item = ConsumptionItem(
            consumption_entry_id=c_entry.id,
            item_id=dal_item.id,
            quantity_used=Decimal("10.00"),
            unit_cost_at_time=Decimal("160.00"),
            line_total=Decimal("1600.00"),
            created_at=now,
            updated_at=now
        )
        db.add(c_item)

        # Update Stock & Ledger
        dal_item.current_stock -= Decimal("10.00")
        ledger_c = StockLedger(
            item_id=dal_item.id,
            txn_date=today,
            txn_type=2, # Consumption
            ref_table="consumption_entries",
            ref_id=c_entry.id,
            qty_out=Decimal("10.00"),
            unit_cost=Decimal("160.00"),
            value_out=Decimal("1600.00"),
            balance=dal_item.current_stock,
            created_at=now,
            updated_at=now
        )
        db.add(ledger_c)
    
    db.commit()
    print("Test data + Transactions seeded successfully!")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_test_data(db)
    finally:
        db.close()

import random
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from app.db.models import (
    Vendor, Unit, ItemCategory, Item, User, PurchaseEntry, PurchaseItem, 
    ConsumptionEntry, ConsumptionItem, StockLedger, VendorPayment, WastageEntry, WastageItem
)
from app.db.session import SessionLocal

def bulk_seed(db: Session):
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        print("Run python -m app.seed first!")
        return
    admin_id = admin.id
    now = datetime.now(timezone.utc)
    
    # 1. Clear existing transactional data to start fresh (Optional, but cleaner for "lots of values")
    # db.query(StockLedger).delete()
    # db.query(PurchaseItem).delete()
    # ... etc

    # 2. Units (Ensure they exist)
    units_data = [
        ("Kilogram", "KG"), ("Litre", "LTR"), ("Packet", "PKT"), 
        ("Number", "NOS"), ("Gram", "GM"), ("MilliLitre", "ML"), ("Bag", "BAG")
    ]
    unit_ids = []
    for name, code in units_data:
        u = db.query(Unit).filter(Unit.unit_code == code).first()
        if not u:
            u = Unit(unit_name=name, unit_code=code, status=1, created_at=now, updated_at=now, created_by=admin_id, updated_by=admin_id)
            db.add(u)
            db.flush()
        unit_ids.append(u.id)

    # 3. Categories
    categories = ["Groceries", "Vegetables", "Dairy", "Cleaning Supplies", "Puja Items", "Stationery", "Kitchen Tools"]
    cat_ids = []
    for c_name in categories:
        cat = db.query(ItemCategory).filter(ItemCategory.category_name == c_name).first()
        if not cat:
            cat = ItemCategory(category_name=c_name, status=1, created_at=now, updated_at=now, created_by=admin_id, updated_by=admin_id)
            db.add(cat)
            db.flush()
        cat_ids.append(cat.id)

    # 4. Vendors (15 Vendors)
    vendor_names = [
        "Sri Krishna Traders", "Udupi Veg Supplies", "A1 Dairy Farm", "CleanPro Solutions",
        "Temple Puja Bhandar", "Coastal Spices", "Karkala Rice Mill", "Prakash General Store",
        "Quality Stationery", "Green Garden Veg", "Modern Kitchenware", "Mangalore Wholesale",
        "Sathwik Food Products", "Reliable Oil Co", "Divine Incense"
    ]
    v_ids = []
    for i, name in enumerate(vendor_names):
        code = f"V{str(i+100).zfill(3)}"
        v = db.query(Vendor).filter(Vendor.vendor_name == name).first()
        if not v:
            v = Vendor(
                vendor_code=code, vendor_name=name, contact_number=f"98{random.randint(10000000, 99999999)}",
                address_line1=f"Building {i*10}, Road {i+1}", city="Udupi", state="Karnataka",
                opening_balance=Decimal("0.00"), current_balance=Decimal("0.00"),
                status=1, created_at=now, updated_at=now, created_by=admin_id, updated_by=admin_id
            )
            db.add(v)
            db.flush()
        v_ids.append(v.id)

    # 5. Items (30 Items)
    items_list = [
        ("Basmati Rice", "Groceries", "KG", 50, 75), ("Toor Dal", "Groceries", "KG", 40, 160),
        ("Coconut Oil", "Groceries", "LTR", 20, 210), ("Salt", "Groceries", "PKT", 100, 25),
        ("Sugar", "Groceries", "KG", 50, 45), ("Tea Powder", "Groceries", "PKT", 30, 120),
        ("Milk", "Dairy", "LTR", 10, 52), ("Curd", "Dairy", "PKT", 20, 30),
        ("Ghee", "Dairy", "KG", 5, 650), ("Tomato", "Vegetables", "KG", 15, 40),
        ("Onion", "Vegetables", "KG", 20, 35), ("Potato", "Vegetables", "KG", 20, 30),
        ("Floor Cleaner", "Cleaning Supplies", "LTR", 10, 150), ("Dish Soap", "Cleaning Supplies", "LTR", 5, 120),
        ("Incense Sticks", "Puja Items", "PKT", 50, 80), ("Camphor", "Puja Items", "PKT", 100, 10),
        ("Turmeric", "Puja Items", "PKT", 20, 200), ("Red Chilli", "Groceries", "KG", 10, 280),
        ("Mustard Seeds", "Groceries", "PKT", 5, 90), ("Cumin", "Groceries", "PKT", 5, 350),
        ("Sandalwood Powder", "Puja Items", "PKT", 10, 500), ("Cotton Wicks", "Puja Items", "PKT", 200, 5),
        ("Detergent", "Cleaning Supplies", "KG", 15, 95), ("Bleach", "Cleaning Supplies", "LTR", 5, 80),
        ("Mop Stick", "Cleaning Supplies", "NOS", 2, 250), ("Paper", "Stationery", "PKT", 10, 300),
        ("Pens", "Stationery", "NOS", 50, 10), ("Large Bowl", "Kitchen Tools", "NOS", 4, 1200),
        ("Knife", "Kitchen Tools", "NOS", 2, 450), ("Ladle", "Kitchen Tools", "NOS", 5, 350)
    ]
    
    item_objs = {}
    for name, cat_name, u_code, min_s, price in items_list:
        it = db.query(Item).filter(Item.item_name == name).first()
        if not it:
            it = Item(
                item_name=name, 
                category_id=db.query(ItemCategory).filter(ItemCategory.category_name == cat_name).first().id,
                unit_id=db.query(Unit).filter(Unit.unit_code == u_code).first().id,
                opening_stock=Decimal(str(random.randint(5, 50))),
                min_stock_level=Decimal(str(min_s)),
                default_price=Decimal(str(price)),
                status=1, created_at=now, updated_at=now, created_by=admin_id, updated_by=admin_id
            )
            it.current_stock = it.opening_stock
            db.add(it)
            db.flush()
        item_objs[name] = it

    # 6. Chefs
    chef_names = ["Ramachandra", "Subramanya", "Ganesha", "Krishna Bhat", "Vasudeva"]
    chef_ids = []
    for name in chef_names:
        c = db.query(Chef).filter(Chef.chef_name == name).first()
        if not c:
            c = Chef(chef_name=name, phone=f"99{random.randint(10000000, 99999999)}", user_id=admin_id, created_at=now, updated_at=now)
            db.add(c)
            db.flush()
        chef_ids.append(c.id)

    # 7. Purchases (50 Transactions over last 30 days)
    print("Seeding Purchases...")
    start_date = date.today() - timedelta(days=30)
    for i in range(50):
        txn_date = start_date + timedelta(days=random.randint(0, 30))
        vendor_id = random.choice(v_ids)
        
        p_entry = PurchaseEntry(
            vendor_id=vendor_id, purchase_date=txn_date,
            bill_no=f"B-{random.randint(10000, 99999)}",
            total_amount=Decimal("0.00"),
            user_id=admin_id, status=1, created_at=now, updated_at=now
        )
        db.add(p_entry)
        db.flush()

        total = Decimal("0.00")
        # 1-4 items per purchase
        items_to_buy = random.sample(list(item_objs.values()), random.randint(1, 4))
        for item in items_to_buy:
            qty = Decimal(str(random.randint(5, 50)))
            price = item.default_price * Decimal(str(round(random.uniform(0.9, 1.1), 2)))
            line_total = qty * price
            
            p_item = PurchaseItem(
                purchase_entry_id=p_entry.id, item_id=item.id,
                quantity=qty, price=price, line_total=line_total,
                created_at=now, updated_at=now
            )
            db.add(p_item)
            total += line_total
            
            # Stock Update
            item.current_stock += qty
            ledger = StockLedger(
                item_id=item.id, txn_date=txn_date, txn_type=1,
                ref_table="purchase_entries", ref_id=p_entry.id,
                qty_in=qty, unit_cost=price, value_in=line_total,
                balance=item.current_stock, created_at=now, updated_at=now
            )
            db.add(ledger)
            
        p_entry.total_amount = total
        # Update Vendor Balance
        vendor = db.get(Vendor, vendor_id)
        vendor.current_balance += total
        
        # Randomly pay some purchases (70% probability)
        if random.random() < 0.7:
            pay_amt = total * Decimal(str(round(random.uniform(0.5, 1.0), 2)))
            payment = VendorPayment(
                vendor_id=vendor_id, payment_date=txn_date,
                amount=pay_amt, payment_mode="UPI", reference_no=f"REF-{random.randint(1000,9999)}",
                user_id=admin_id, created_at=now, updated_at=now
            )
            db.add(payment)
            vendor.current_balance -= pay_amt

    # 8. Consumptions (80 Transactions)
    print("Seeding Consumptions...")
    for i in range(80):
        txn_date = start_date + timedelta(days=random.randint(0, 30))
        
        c_entry = ConsumptionEntry(
            usage_date=txn_date, 
            people_served=random.randint(100, 1000),
            user_id=admin_id, status=1, created_at=now, updated_at=now
        )
        db.add(c_entry)
        db.flush()

        items_to_use = random.sample(list(item_objs.values()), random.randint(1, 5))
        for item in items_to_use:
            # Don't consume more than current stock (keep it simple)
            max_can_use = float(item.current_stock) if item.current_stock > 1 else 1.0
            qty = Decimal(str(round(random.uniform(0.5, min(10.0, max_can_use)), 2)))
            
            c_item = ConsumptionItem(
                consumption_entry_id=c_entry.id, item_id=item.id,
                quantity_used=qty, unit_cost_at_time=item.default_price,
                line_total=qty * item.default_price,
                created_at=now, updated_at=now
            )
            db.add(c_item)
            
            # Stock Update
            item.current_stock -= qty
            ledger = StockLedger(
                item_id=item.id, txn_date=txn_date, txn_type=2,
                ref_table="consumption_entries", ref_id=c_entry.id,
                qty_out=qty, unit_cost=item.default_price, value_out=qty * item.default_price,
                balance=item.current_stock, created_at=now, updated_at=now
            )
            db.add(ledger)

    # 9. Wastages (20 Transactions)
    print("Seeding Wastages...")
    reasons = ["Expiring", "Spillage", "Quality Issue", "Rodent Damage", "Contamination"]
    for i in range(20):
        txn_date = start_date + timedelta(days=random.randint(0, 30))
        w_entry = WastageEntry(
            wastage_date=txn_date, reason=random.choice(reasons),
            user_id=admin_id, status=1, created_at=now, updated_at=now
        )
        db.add(w_entry)
        db.flush()

        items_to_waste = random.sample(list(item_objs.values()), random.randint(1, 2))
        for item in items_to_waste:
            qty = Decimal(str(round(random.uniform(0.1, 2.0), 2)))
            w_item = WastageItem(
                wastage_entry_id=w_entry.id, item_id=item.id,
                quantity=qty, 
                unit_cost_at_time=item.default_price,
                line_total=qty * item.default_price,
                created_at=now, updated_at=now
            )
            db.add(w_item)
            
            # Stock Update
            item.current_stock -= qty
            ledger = StockLedger(
                item_id=item.id, txn_date=txn_date, txn_type=3, # Wastage
                ref_table="wastage_entries", ref_id=w_entry.id,
                qty_out=qty, unit_cost=item.default_price, value_out=qty * item.default_price,
                balance=item.current_stock, created_at=now, updated_at=now
            )
            db.add(ledger)

    db.commit()
    print("Bulk Seeding Completed Successfully!")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        bulk_seed(db)
    finally:
        db.close()

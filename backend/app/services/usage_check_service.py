from sqlalchemy.orm import Session
from app.db.models import (
    Item, Vendor, ItemCategory, MenuItem, Unit, 
    PurchaseEntry, PurchaseItem, 
    ConsumptionItem, WastageItem, StockLedger
)

def check_entity_usage(entity_type: str, entity_id: int, db: Session) -> dict:
    """
    Checks if an entity is referenced in other tables.
    Returns { "has_usage": bool, "details": list[str] }
    """
    has_usage = False
    details = []

    if entity_type == "vendor":
        # Check purchases
        purchase_count = db.query(PurchaseEntry).filter(PurchaseEntry.vendor_id == entity_id, PurchaseEntry.status == 1).count()
        if purchase_count > 0:
            has_usage = True
            details.append(f"Linked to {purchase_count} purchase records")

    elif entity_type == "item":
        # Check stock ledger
        ledger_count = db.query(StockLedger).filter(StockLedger.item_id == entity_id, StockLedger.status == 1).count()
        if ledger_count > 0:
            has_usage = True
            details.append("Has transaction history in stock ledger")
        
        # Check current stock
        item = db.query(Item).filter(Item.id == entity_id).first()
        if item and float(item.current_stock or 0) > 0:
            has_usage = True
            details.append(f"Currently has {item.current_stock} units in stock")

    elif entity_type == "category":
        # Check items
        item_count = db.query(Item).filter(Item.category_id == entity_id, Item.status == 1).count()
        if item_count > 0:
            has_usage = True
            details.append(f"Linked to {item_count} active items")

    elif entity_type == "menu_item":
        # Check wastage
        wastage_count = db.query(WastageItem).filter(WastageItem.menu_item_id == entity_id).count()
        if wastage_count > 0:
            has_usage = True
            details.append(f"Linked to {wastage_count} wastage records")

    elif entity_type == "unit":
        # Check items
        item_count = db.query(Item).filter(Item.unit_id == entity_id).count()
        if item_count > 0:
            has_usage = True
            details.append(f"Linked to {item_count} raw items")
            
        # Check menu items
        menu_count = db.query(MenuItem).filter(MenuItem.unit_id == entity_id).count()
        if menu_count > 0:
            has_usage = True
            details.append(f"Linked to {menu_count} menu items/dishes")

    return {
        "has_usage": has_usage,
        "details": details
    }

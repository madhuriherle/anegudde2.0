from datetime import datetime, timezone
from decimal import Decimal
import math

from fastapi import HTTPException
from sqlalchemy import String
from sqlalchemy.orm import Session, joinedload

from app.db.models import Item, User, StockLedger, PurchaseItem, ConsumptionItem, WastageItem, ItemCategory, Unit, ItemType, ItemPrice, PurchaseEntry, Vendor
from app.schemas.item import ItemCreate, ItemUpdate


def validate_fk(db: Session, payload: ItemCreate | ItemUpdate, type_id: int | None = None):
    if type_id is not None:
        item_type = db.query(ItemType).filter(ItemType.id == type_id, ItemType.status == 1).first()
        if not item_type:
            raise HTTPException(status_code=400, detail="Invalid type_id")
    if hasattr(payload, "category_id") and payload.category_id is not None:
        category = db.query(ItemCategory).filter(ItemCategory.id == payload.category_id).first()
        if not category:
            raise HTTPException(status_code=400, detail="Invalid category_id")
        if type_id is not None and category.type_id != type_id:
            raise HTTPException(status_code=400, detail="category_id does not belong to provided type_id")
    if hasattr(payload, "unit_id") and payload.unit_id is not None:
        if not db.query(Unit).filter(Unit.id == payload.unit_id).first():
            raise HTTPException(status_code=400, detail="Invalid unit_id")


def create_item(payload: ItemCreate, db: Session, current_user: User, type_id: int | None = None) -> Item:
    validate_fk(db, payload, type_id)
    exists = db.query(Item).filter(Item.item_name == payload.item_name).first()
    if exists:
        raise HTTPException(status_code=400, detail="item_name already exists")

    now = datetime.now(timezone.utc)
    
    data = payload.model_dump()
        
    item = Item(
        **data,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_items(
    db: Session, 
    page: int, 
    page_size: int, 
    q: str | None, 
    status: int | None = None,
    category_id: int | None = None,
    type_id: int | None = None,
    search_field: str | None = None,
    sort_by: str = "id", 
    sort_order: str = "desc"
) -> dict:
    import re
    query = db.query(Item).join(ItemCategory, Item.category_id == ItemCategory.id).options(
        joinedload(Item.category),
        joinedload(Item.unit),
        joinedload(Item.serial_numbers)
    )
    
    if status is not None:
        query = query.filter(Item.status == status)
    
    if category_id is not None:
        query = query.filter(Item.category_id == category_id)
    if type_id is not None:
        query = query.filter(ItemCategory.type_id == type_id)

    # Smart Search: Extract dates from q if present
    from_date, to_date = None, None
    if q:
        # Look for YYYY-MM-DD patterns
        date_patterns = re.findall(r"\d{4}-\d{2}-\d{2}", q)
        if len(date_patterns) >= 2:
            from_date, to_date = date_patterns[0], date_patterns[1]
            # Remove dates from q to avoid searching them as text
            q = re.sub(r"\d{4}-\d{2}-\d{2}", "", q).strip()
        elif len(date_patterns) == 1:
            from_date = to_date = date_patterns[0]
            q = re.sub(r"\d{4}-\d{2}-\d{2}", "", q).strip()

    if from_date:
        query = query.filter(Item.created_at >= from_date)
    if to_date:
        query = query.filter(Item.created_at <= f"{to_date} 23:59:59")

    if q:
        like = f"%{q}%"
        if search_field == "name":
            query = query.filter(Item.item_name.ilike(like))
        elif search_field == "id":
            query = query.filter(Item.id.cast(String).ilike(like))
        elif search_field == "serial":
            query = query.join(Item.serial_numbers).filter(ItemSerialNumber.serial_number.ilike(like))
        elif search_field == "category":
            query = query.join(ItemCategory).filter(ItemCategory.category_name.ilike(like))
        elif search_field == "unit":
            query = query.join(Unit).filter(Unit.unit_name.ilike(like))
        else:
            query = query.outerjoin(Item.serial_numbers).outerjoin(ItemCategory).outerjoin(Unit).filter(
                (Item.item_name.ilike(like)) |
                (Item.id.cast(String).ilike(like)) |
                (ItemSerialNumber.serial_number.ilike(like)) |
                (ItemCategory.category_name.ilike(like)) |
                (Unit.unit_name.ilike(like))
            )
            
    # Default sorting: Status (Active first), then Item Name (A-Z)
    if sort_by == "id" and sort_order == "desc":
        query = query.order_by(Item.status.desc(), Item.item_name.asc())
    else:
        sort_col = getattr(Item, sort_by, Item.id)
        query = query.order_by(sort_col.asc() if sort_order.lower() == "asc" else sort_col.desc())
    
    total = query.count()
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }


def get_item(item_id: int, db: Session) -> Item:
    item = db.query(Item).options(joinedload(Item.unit)).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


def update_item(item_id: int, payload: ItemUpdate, db: Session, current_user: User, type_id: int | None = None) -> Item:
    item = get_item(item_id, db)
    validate_fk(db, payload, type_id)

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    item.updated_at = datetime.now(timezone.utc)
    item.updated_by = current_user.id
    db.commit()
    db.refresh(item)
    return item


def delete_item(item_id: int, db: Session) -> None:
    item = get_item(item_id, db)
    item.status = 0
    db.commit()


def get_item_last_price(item_id: int, db: Session) -> Decimal:
    # 1. Try to get from last purchase
    last_purchase = (
        db.query(PurchaseItem)
        .filter(PurchaseItem.item_id == item_id)
        .order_by(PurchaseItem.id.desc())
        .first()
    )
    if last_purchase:
        return last_purchase.price
    
    # 2. Try to get from item default price
    item = db.query(Item).filter(Item.id == item_id).first()
    if item and item.default_price:
        return item.default_price
        
    return Decimal("0")


def get_item_ledger(item_id: int, db: Session, page: int = 1, page_size: int = 20) -> dict:
    _ = get_item(item_id, db)
    query = db.query(StockLedger).filter(StockLedger.item_id == item_id)
    
    total = query.count()
    offset = (page - 1) * page_size
    
    items = (
        query.order_by(StockLedger.txn_date.desc(), StockLedger.id.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }


def get_price_history(item_id: int, db: Session) -> list[dict]:
    _ = get_item(item_id, db)
    # Fetch all prices ordered by date desc
    prices = (
        db.query(ItemPrice)
        .outerjoin(PurchaseEntry, ItemPrice.purchase_entry_id == PurchaseEntry.id)
        .outerjoin(Vendor, PurchaseEntry.vendor_id == Vendor.id)
        .filter(ItemPrice.item_id == item_id)
        .order_by(ItemPrice.created_at.desc())
        .all()
    )
    
    unique_prices = []
    seen_prices = set()
    
    for p in prices:
        # Round to avoid precision issues in unique check
        price_val = float(round(p.price, 2))
        if price_val not in seen_prices:
            unique_prices.append({
                "id": p.id,
                "price": p.price,
                "created_at": p.created_at,
                "purchase_date": p.purchase.purchase_date if p.purchase else p.created_at.date(),
                "vendor_name": p.purchase.vendor.vendor_name if p.purchase and p.purchase.vendor else "Manual/Opening",
                "bill_no": p.purchase.bill_no if p.purchase else "-"
            })
            seen_prices.add(price_val)
            
    return unique_prices

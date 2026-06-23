from datetime import datetime, timezone
from decimal import Decimal
import math

from fastapi import HTTPException
from sqlalchemy import String, case, func, Integer
from sqlalchemy.orm import Session, joinedload

from app.db.models import Item, User, StockLedger, PurchaseItem, ConsumptionItem, WastageItem, ItemCategory, Unit, ItemType, ItemPrice, PurchaseEntry, Vendor, ItemSerialNumber
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
    serial_no = data.pop("serial_number", None)
    data["current_stock"] = data.get("opening_stock", Decimal("0"))
    data["opening_price"] = data.get("default_price")
        
    item = Item(
        **data,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(item)
    db.flush()

    if serial_no:
        target_serial = serial_no
    else:
        max_serial = db.query(
            func.max(ItemSerialNumber.serial_number.cast(Integer))
        ).filter(
            ItemSerialNumber.serial_number.op('~')('^\d+$')
        ).scalar()
        next_num = (max_serial or 0) + 1
        target_serial = str(next_num).zfill(4)
    
    s_exists = db.query(ItemSerialNumber).filter(ItemSerialNumber.serial_number == target_serial).first()
    if s_exists:
        raise HTTPException(status_code=400, detail=f"Serial number {target_serial} already assigned to another item")
    
    new_s = ItemSerialNumber(item_id=item.id, serial_number=target_serial, status=1)
    db.add(new_s)

    opening_stock = data.get("opening_stock")
    if opening_stock and Decimal(str(opening_stock)) > 0:
        default_price = data.get("default_price")
        unit_cost = Decimal(str(default_price)) if default_price else Decimal("0")
        txn_date = now.date()
        db.add(StockLedger(
            item_id=item.id,
            txn_date=txn_date,
            txn_type=4,
            ref_table="items",
            ref_id=item.id,
            qty_in=Decimal(str(opening_stock)),
            qty_out=0,
            unit_cost=unit_cost,
            value_in=Decimal(str(opening_stock)) * unit_cost,
            value_out=0,
            balance=Decimal(str(opening_stock)),
            current_value=Decimal(str(opening_stock)) * unit_cost,
            created_at=now,
            updated_at=now,
            created_by=current_user.id,
            updated_by=current_user.id,
        ))

    default_price = data.get("default_price")
    if default_price and Decimal(str(default_price)) > 0:
        db.add(ItemPrice(
            item_id=item.id,
            price=Decimal(str(default_price)),
            purchase_entry_id=None,
            created_at=now,
            created_by=current_user.id,
        ))

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
    # Start with base query and joinedloads for efficiency
    query = db.query(Item).filter(Item.is_deleted == False).options(
        joinedload(Item.category),
        joinedload(Item.unit),
        joinedload(Item.serial_numbers)
    )
    
    # Always join ItemCategory if we need to filter by type_id or search it
    # We'll use outerjoin to avoid excluding items without categories (if any)
    query = query.outerjoin(ItemCategory, Item.category_id == ItemCategory.id)
    query = query.outerjoin(Unit, Item.unit_id == Unit.id)
    
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
            query = query.outerjoin(ItemSerialNumber).filter(ItemSerialNumber.serial_number.ilike(like))
        elif search_field == "category":
            query = query.filter(ItemCategory.category_name.ilike(like))
        elif search_field == "unit":
            query = query.filter(Unit.unit_name.ilike(like))
        else:
            # Need ItemSerialNumber for global search
            query = query.outerjoin(ItemSerialNumber)
            query = query.filter(
                (Item.item_name.ilike(like)) |
                (Item.id.cast(String).ilike(like)) |
                (ItemSerialNumber.serial_number.ilike(like)) |
                (ItemCategory.category_name.ilike(like)) |
                (Unit.unit_name.ilike(like))
            )
            
    # Default sorting: Status (Active first), then configured display order, then Item Name (A-Z)
    if sort_by == "id" and sort_order == "desc":
        query = query.order_by(
            Item.status.desc(),
            case((Item.display_order.is_(None), 1), else_=0).asc(),
            Item.display_order.asc(),
            Item.item_name.asc(),
        )
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
    item = (
        db.query(Item)
        .options(joinedload(Item.category), joinedload(Item.unit))
        .filter(Item.id == item_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


def update_item(item_id: int, payload: ItemUpdate, db: Session, current_user: User, type_id: int | None = None) -> Item:
    item = get_item(item_id, db)
    validate_fk(db, payload, type_id)

    data = payload.model_dump(exclude_unset=True)
    serial_no = data.pop("serial_number", None)

    for key, value in data.items():
        setattr(item, key, value)
    
    if serial_no is not None:
        # Check if this serial already exists for ANOTHER item
        existing_s = db.query(ItemSerialNumber).filter(
            ItemSerialNumber.serial_number == serial_no,
            ItemSerialNumber.item_id != item_id
        ).first()
        if existing_s:
            raise HTTPException(status_code=400, detail=f"Serial number {serial_no} is already assigned to another item")
        
        # Update or create serial for this item
        # In a simple "Code" system, we assume one active code per item
        current_s = db.query(ItemSerialNumber).filter(ItemSerialNumber.item_id == item_id).first()
        if current_s:
            current_s.serial_number = serial_no
        else:
            new_s = ItemSerialNumber(item_id=item_id, serial_number=serial_no, status=1)
            db.add(new_s)

    item.updated_at = datetime.now(timezone.utc)
    item.updated_by = current_user.id
    db.commit()
    db.refresh(item)
    return item


def delete_item(item_id: int, db: Session, user_id: int | None = None) -> None:
    from datetime import datetime, timezone
    item = get_item(item_id, db)
    item.is_deleted = True
    item.deleted_at = datetime.now(timezone.utc)
    item.deleted_by_id = user_id
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

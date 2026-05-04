from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import String
from sqlalchemy.orm import Session, joinedload

from app.db.models import Item, User, StockLedger, PurchaseItem, ConsumptionItem, WastageItem, ItemCategory, Unit
from app.schemas.item import ItemCreate, ItemUpdate


def validate_fk(db: Session, payload: ItemCreate | ItemUpdate):
    if hasattr(payload, "category_id") and payload.category_id is not None:
        if not db.query(ItemCategory).filter(ItemCategory.id == payload.category_id).first():
            raise HTTPException(status_code=400, detail="Invalid category_id")
    if hasattr(payload, "unit_id") and payload.unit_id is not None:
        if not db.query(Unit).filter(Unit.id == payload.unit_id).first():
            raise HTTPException(status_code=400, detail="Invalid unit_id")


def create_item(payload: ItemCreate, db: Session, current_user: User) -> Item:
    validate_fk(db, payload)
    exists = db.query(Item).filter(Item.item_name == payload.item_name).first()
    if exists:
        raise HTTPException(status_code=400, detail="item_name already exists")

    now = datetime.now(timezone.utc)
    item = Item(
        **payload.model_dump(),
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
    search_field: str | None = None,
    sort_by: str = "id", 
    sort_order: str = "desc"
) -> list[Item]:
    query = db.query(Item).options(
        joinedload(Item.category),
        joinedload(Item.unit)
    )
    
    if status is not None:
        query = query.filter(Item.status == status)
    
    if category_id is not None:
        query = query.filter(Item.category_id == category_id)

    if q:
        like = f"%{q}%"
        if search_field == "name":
            query = query.filter(Item.item_name.ilike(like))
        elif search_field == "id":
            query = query.filter(Item.id.cast(String).ilike(like))
        elif search_field == "category":
            query = query.join(ItemCategory).filter(ItemCategory.category_name.ilike(like))
        elif search_field == "unit":
            query = query.join(Unit).filter(Unit.unit_name.ilike(like))
        else:
            query = query.outerjoin(ItemCategory).outerjoin(Unit).filter(
                (Item.item_name.ilike(like)) |
                (Item.id.cast(String).ilike(like)) |
                (ItemCategory.category_name.ilike(like)) |
                (Unit.unit_name.ilike(like))
            )
            
    sort_col = getattr(Item, sort_by, Item.id)
    query = query.order_by(sort_col.asc() if sort_order.lower() == "asc" else sort_col.desc())
    offset = (page - 1) * page_size
    return query.offset(offset).limit(page_size).all()


def get_item(item_id: int, db: Session) -> Item:
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


def update_item(item_id: int, payload: ItemUpdate, db: Session, current_user: User) -> Item:
    item = get_item(item_id, db)
    validate_fk(db, payload)

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


def get_item_ledger(item_id: int, db: Session) -> list[StockLedger]:
    _ = get_item(item_id, db)
    return (
        db.query(StockLedger)
        .filter(StockLedger.item_id == item_id)
        .order_by(StockLedger.txn_date.desc(), StockLedger.id.desc())
        .limit(100)
        .all()
    )

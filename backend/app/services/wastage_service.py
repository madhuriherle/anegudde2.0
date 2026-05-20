from datetime import datetime, timezone
import math
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.models import MenuItem, User, WastageEntry, WastageItem, Item, StockLedger
from app.schemas.wastage import WastageEntryCreate, WastageEntryUpdate
from decimal import Decimal

def list_wastages(db: Session, page: int = 1, page_size: int = 20, q: str = None, status: int = None, search_field: str = None):
    query = db.query(WastageEntry).options(
        joinedload(WastageEntry.items).joinedload(WastageItem.menu_item), 
        joinedload(WastageEntry.items).joinedload(WastageItem.item).joinedload(Item.unit),
        joinedload(WastageEntry.user)
    )
    if status is not None: 
        query = query.filter(WastageEntry.status == status)
    
    # Optional search logic
    if q:
        from sqlalchemy import or_
        query = query.join(WastageEntry.items).join(WastageItem.menu_item).filter(
            or_(
                WastageEntry.reason.ilike(f"%{q}%"),
                MenuItem.dish_name.ilike(f"%{q}%")
            )
        ).distinct()

    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(WastageEntry.id.desc()).offset(offset).limit(page_size).all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }

from app.utils.date_utils import get_today_ist

def create_wastage(payload: WastageEntryCreate, db: Session, current_user: User) -> WastageEntry:
    now = datetime.now(timezone.utc)
    today = get_today_ist()
    
    # --- SAFETY BLOCK: Prevent Future Dates ---
    if payload.wastage_date > today:
        raise HTTPException(status_code=400, detail="Wastage date cannot be in the future.")

    entry = WastageEntry(
        wastage_date=payload.wastage_date, 
        consumption_entry_id=payload.consumption_entry_id,
        times_cooked=payload.times_cooked,
        user_id=payload.user_id, 
        status=payload.status, 
        created_at=now, 
        updated_at=now, 
        created_by=current_user.id, 
        updated_by=current_user.id
    )
    db.add(entry); db.flush()
    
    for it in payload.items:
        # Skip zero quantity items
        if Decimal(str(it.quantity)) <= 0:
            continue

        wastage_item = WastageItem(
            wastage_entry_id=entry.id, 
            consumption_entry_id=payload.consumption_entry_id,
            wastage_date=payload.wastage_date, 
            menu_item_id=it.menu_item_id, 
            item_id=it.item_id,
            quantity=it.quantity, 
            approx_amount=it.approx_amount,
            created_at=now, 
            updated_at=now, 
            created_by=current_user.id, 
            updated_by=current_user.id
        )
        db.add(wastage_item)
        
        # If it's a raw item wastage (should be handled by stock_adjustment_service now, 
        # but kept for legacy/compatibility if called directly with item_id)
        if it.item_id:
            item = db.query(Item).filter(Item.id == it.item_id).first()
            if item:
                qty = Decimal(str(it.quantity))
                current_stock = Decimal(item.current_stock or 0)
                
                if (current_stock - qty) < 0:
                    raise HTTPException(
                        status_code=422, 
                        detail=f"Insufficient stock for item '{item.item_name}'. Current stock is {current_stock} but trying to waste {qty}."
                    )

                item.current_stock = current_stock - qty
                item.updated_at = now
                item.updated_by = current_user.id
                
                unit_cost = item.default_price or 0
                db.add(StockLedger(
                    item_id=item.id,
                    txn_date=payload.wastage_date,
                    txn_type=3, # Wastage (Type 3) - for raw item wastage
                    ref_table="wastage_items",
                    ref_id=entry.id,
                    qty_in=0,
                    qty_out=qty,
                    unit_cost=unit_cost,
                    value_in=0,
                    value_out=qty * unit_cost,
                    balance=Decimal(item.current_stock),
                    current_value=Decimal(item.current_stock) * unit_cost,
                    created_at=now,
                    updated_at=now,
                    created_by=current_user.id,
                    updated_by=current_user.id
                ))

    db.commit(); db.refresh(entry); return entry

def get_wastage(wastage_id: int, db: Session) -> WastageEntry:
    entry = db.query(WastageEntry).filter(WastageEntry.id == wastage_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Not found")
    return entry

def get_wastage_full(wastage_id: int, db: Session) -> WastageEntry:
    entry = db.query(WastageEntry).options(
        joinedload(WastageEntry.user),
        joinedload(WastageEntry.items).joinedload(WastageItem.menu_item),
        joinedload(WastageEntry.items).joinedload(WastageItem.item).joinedload(Item.unit)
    ).filter(WastageEntry.id == wastage_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Not found")
    return entry

def delete_wastage(wastage_id: int, db: Session, current_user: User) -> None:
    entry = get_wastage(wastage_id, db)
    # Restore stock for raw items
    wastage_items = db.query(WastageItem).filter(WastageItem.wastage_entry_id == wastage_id).all()
    for w_item in wastage_items:
        if w_item.item_id:
            item = db.query(Item).filter(Item.id == w_item.item_id).first()
            if item:
                item.current_stock = Decimal(item.current_stock or 0) + Decimal(str(w_item.quantity))
    
    db.query(WastageItem).filter(WastageItem.wastage_entry_id == wastage_id).delete()
    db.query(StockLedger).filter(StockLedger.ref_table == "wastage_items", StockLedger.ref_id == wastage_id).delete()
    db.delete(entry); db.commit()

def update_wastage(wastage_id: int, payload: WastageEntryUpdate, db: Session, current_user: User) -> WastageEntry:
    entry = get_wastage(wastage_id, db)
    now = datetime.now(timezone.utc)
    today = get_today_ist()

    if payload.wastage_date > today:
        raise HTTPException(status_code=400, detail="Wastage date cannot be in the future.")

    # Reverse previous stock effect for raw-item wastage rows.
    old_items = db.query(WastageItem).filter(WastageItem.wastage_entry_id == wastage_id).all()
    for old in old_items:
        if old.item_id:
            item = db.query(Item).filter(Item.id == old.item_id).first()
            if item:
                item.current_stock = Decimal(item.current_stock or 0) + Decimal(str(old.quantity))
                item.updated_at = now
                item.updated_by = current_user.id

    # Remove old detail rows and old ledger rows tied to this entry id.
    db.query(WastageItem).filter(WastageItem.wastage_entry_id == wastage_id).delete()
    db.query(StockLedger).filter(
        StockLedger.ref_table == "wastage_items",
        StockLedger.ref_id == wastage_id
    ).delete()

    # Update main entry in place.
    entry.wastage_date = payload.wastage_date
    entry.consumption_entry_id = payload.consumption_entry_id
    entry.times_cooked = payload.times_cooked
    entry.updated_at = now
    entry.updated_by = current_user.id

    # Apply new wastage rows and stock impact.
    for it in payload.items:
        if Decimal(str(it.quantity)) <= 0:
            continue

        wastage_item = WastageItem(
            wastage_entry_id=entry.id,
            consumption_entry_id=payload.consumption_entry_id,
            wastage_date=payload.wastage_date,
            menu_item_id=it.menu_item_id,
            item_id=it.item_id,
            quantity=it.quantity,
            approx_amount=it.approx_amount,
            created_at=now,
            updated_at=now,
            created_by=current_user.id,
            updated_by=current_user.id
        )
        db.add(wastage_item)

        if it.item_id:
            item = db.query(Item).filter(Item.id == it.item_id).first()
            if item:
                qty = Decimal(str(it.quantity))
                current_stock = Decimal(item.current_stock or 0)
                if (current_stock - qty) < 0:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Insufficient stock for item '{item.item_name}'. Current stock is {current_stock} but trying to waste {qty}."
                    )

                item.current_stock = current_stock - qty
                item.updated_at = now
                item.updated_by = current_user.id

                unit_cost = item.default_price or 0
                db.add(StockLedger(
                    item_id=item.id,
                    txn_date=payload.wastage_date,
                    txn_type=3,  # Wastage
                    ref_table="wastage_items",
                    ref_id=entry.id,
                    qty_in=0,
                    qty_out=qty,
                    unit_cost=unit_cost,
                    value_in=0,
                    value_out=qty * unit_cost,
                    balance=Decimal(item.current_stock),
                    current_value=Decimal(item.current_stock) * unit_cost,
                    created_at=now,
                    updated_at=now,
                    created_by=current_user.id,
                    updated_by=current_user.id
                ))

    db.commit()
    return get_wastage_full(entry.id, db)

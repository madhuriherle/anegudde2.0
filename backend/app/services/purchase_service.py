from datetime import datetime, timezone
from decimal import Decimal
import math
import os
from pathlib import Path
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.db.models import Item, PurchaseEntry, PurchaseItem, StockLedger, User, Vendor, ItemPrice, PurchaseBill
from app.schemas.purchase import PurchaseEntryCreate, PurchaseEntryUpdate

def list_purchases(db: Session, page: int = 1, page_size: int = 20, q: str = None, status: int = None, search_field: str = None):
    import re
    query = db.query(PurchaseEntry).options(
        joinedload(PurchaseEntry.items), 
        joinedload(PurchaseEntry.vendor), 
        joinedload(PurchaseEntry.user),
        joinedload(PurchaseEntry.bills)
    )
    
    if status is not None: 
        query = query.filter(PurchaseEntry.status == status)

    # Smart Search: Extract dates from q if present
    from_date, to_date = None, None
    if q:
        date_patterns = re.findall(r"\d{4}-\d{2}-\d{2}", q)
        if len(date_patterns) >= 2:
            from_date, to_date = date_patterns[0], date_patterns[1]
            q = re.sub(r"\d{4}-\d{2}-\d{2}", "", q).strip()
        elif len(date_patterns) == 1:
            from_date = to_date = date_patterns[0]
            q = re.sub(r"\d{4}-\d{2}-\d{2}", "", q).strip()

    if from_date:
        query = query.filter(PurchaseEntry.purchase_date >= from_date)
    if to_date:
        query = query.filter(PurchaseEntry.purchase_date <= to_date)

    if q:
        like = f"%{q}%"
        # Join with Vendor and PurchaseItem -> Item to search by names
        query = query.join(Vendor).outerjoin(PurchaseItem).outerjoin(Item)
        query = query.filter(
            (PurchaseEntry.bill_no.ilike(like)) |
            (Vendor.vendor_name.ilike(like)) |
            (Item.item_name.ilike(like))
        ).distinct()

    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(PurchaseEntry.id.desc()).offset(offset).limit(page_size).all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }

def create_purchase(payload: PurchaseEntryCreate, db: Session, current_user: User) -> PurchaseEntry:
    now = datetime.now(timezone.utc)
    total = Decimal("0")
    for it in payload.items: total += it.quantity * it.price
    
    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=400, detail="Invalid vendor_id")

    entry = PurchaseEntry(
        vendor_id=payload.vendor_id, 
        purchase_date=payload.purchase_date, 
        bill_no=payload.bill_no, 
        total_amount=total, 
        invoice_amount=payload.invoice_amount,
        user_id=payload.user_id, 
        status=payload.status, 
        created_at=now, 
        updated_at=now, 
        created_by=current_user.id, 
        updated_by=current_user.id
    )
    db.add(entry); db.flush()
    
    for it in payload.items:
        item = db.query(Item).filter(Item.id == it.item_id).first()
        if item:
            line_total = it.quantity * it.price
            db.add(PurchaseItem(
                purchase_entry_id=entry.id, 
                purchase_date=payload.purchase_date, 
                item_id=it.item_id, 
                quantity=it.quantity, 
                price=it.price, 
                line_total=line_total, 
                status=1, 
                created_at=now, 
                updated_at=now, 
                created_by=current_user.id, 
                updated_by=current_user.id
            ))
            
            # Update Item Stock and Price
            item.current_stock = str(Decimal(item.current_stock or "0") + it.quantity)
            item.default_price = it.price
            item.updated_at = now
            item.updated_by = current_user.id

            # Record in ItemPrice history table
            db.add(ItemPrice(
                item_id=item.id,
                price=it.price,
                purchase_entry_id=entry.id,
                created_at=now,
                created_by=current_user.id
            ))

            db.add(StockLedger(
                item_id=item.id, 
                txn_date=payload.purchase_date, 
                txn_type=1, 
                ref_table="purchase_entries", 
                ref_id=entry.id, 
                qty_in=it.quantity, 
                qty_out=0, 
                unit_cost=it.price, 
                value_in=line_total, 
                value_out=0, 
                balance=Decimal(item.current_stock), 
                current_value=Decimal(item.current_stock) * it.price,
                created_at=now, 
                updated_at=now, 
                created_by=current_user.id, 
                updated_by=current_user.id
            ))

    db.commit()
    db.refresh(entry)
    return entry

def get_purchase(purchase_id: int, db: Session) -> PurchaseEntry:
    entry = db.query(PurchaseEntry).filter(PurchaseEntry.id == purchase_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Not found")
    return entry

def get_purchase_full(purchase_id: int, db: Session) -> PurchaseEntry:
    entry = (
        db.query(PurchaseEntry)
        .options(joinedload(PurchaseEntry.user), joinedload(PurchaseEntry.items), joinedload(PurchaseEntry.bills))
        .filter(PurchaseEntry.id == purchase_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return entry

def delete_purchase(purchase_id: int, db: Session, current_user: User) -> None:
    entry = (
        db.query(PurchaseEntry)
        .options(joinedload(PurchaseEntry.bills))
        .filter(PurchaseEntry.id == purchase_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
        
    base_dir = Path(__file__).resolve().parents[2]
    for bill in entry.bills:
        if bill.file_path:
            file_path = base_dir / bill.file_path
            if file_path.exists() and file_path.is_file():
                try:
                    os.remove(file_path)
                except OSError:
                    pass
    
    # We should also handle stock reversal here if needed, but for now we just delete records.
    db.query(PurchaseItem).filter(PurchaseItem.purchase_entry_id == purchase_id).delete()
    db.query(StockLedger).filter(StockLedger.ref_table == "purchase_entries", StockLedger.ref_id == purchase_id).delete()
    db.delete(entry)
    db.commit()

def update_purchase(purchase_id: int, payload: PurchaseEntryUpdate, db: Session, current_user: User) -> PurchaseEntry:
    # Simpler to delete and recreate for complex nested updates in this MVP
    delete_purchase(purchase_id, db, current_user)
    new_entry = create_purchase(payload, db, current_user)
    return get_purchase_full(new_entry.id, db)

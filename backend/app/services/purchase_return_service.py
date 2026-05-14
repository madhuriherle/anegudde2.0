from datetime import datetime, timezone
from decimal import Decimal
import math
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.models import Item, PurchaseEntry, PurchaseItem, PurchaseReturnEntry, PurchaseReturnItem, StockLedger, User, Vendor

def list_purchase_returns(db: Session, page: int = 1, page_size: int = 20, q: str = None, vendor_id: int = None):
    query = db.query(PurchaseReturnEntry).options(
        joinedload(PurchaseReturnEntry.items).joinedload(PurchaseReturnItem.item),
        joinedload(PurchaseReturnEntry.vendor),
        joinedload(PurchaseReturnEntry.user),
        joinedload(PurchaseReturnEntry.purchase_entry)
    )
    query = query.filter(PurchaseReturnEntry.status == 1)
    
    if vendor_id:
        query = query.filter(PurchaseReturnEntry.vendor_id == vendor_id)
        
    if q:
        q = q.strip()
        try:
            return_date = datetime.strptime(q, "%Y-%m-%d").date()
            query = query.filter(PurchaseReturnEntry.return_date == return_date)
        except ValueError:
            like = f"%{q}%"
            query = query.join(Vendor)
            query = query.filter(Vendor.vendor_name.ilike(like))

    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(PurchaseReturnEntry.id.desc()).offset(offset).limit(page_size).all()

    # Map original purchase details for the View Dialog
    for entry in items:
        if entry.purchase_entry:
            # Create a map of item_id -> purchase_item for quick lookup
            purchase_map = {pi.item_id: pi for pi in entry.purchase_entry.items}
            for ri in entry.items:
                pi = purchase_map.get(ri.item_id)
                if pi:
                    ri.original_purchase_qty = pi.quantity
                    ri.original_purchase_price = pi.price

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }

def create_purchase_return(payload, db: Session, current_user: User):
    now = datetime.now(timezone.utc)
    
    total_amount = Decimal("0")
    for it in payload.items:
        total_amount += it.quantity * it.price
        
    entry = PurchaseReturnEntry(
        return_date=payload.return_date,
        vendor_id=payload.vendor_id,
        purchase_entry_id=payload.purchase_entry_id,
        total_return_amount=total_amount,
        remarks=payload.remarks,
        user_id=current_user.id,
        status=1,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id
    )
    db.add(entry)
    db.flush()
    
    for it in payload.items:
        line_total = it.quantity * it.price
        return_item = PurchaseReturnItem(
            return_entry_id=entry.id,
            item_id=it.item_id,
            quantity=it.quantity,
            price=it.price,
            line_total=line_total,
            created_at=now
        )
        db.add(return_item)
        
        # Update stock
        item = db.query(Item).filter(Item.id == it.item_id).first()
        if item:
            item.current_stock -= it.quantity
            item.updated_at = now
            
            # Ledger Entry (Transaction Type 5 for Purchase Return)
            db.add(StockLedger(
                item_id=item.id,
                txn_date=payload.return_date,
                txn_type=5, # Transaction Type 5 for Purchase Return
                ref_table="purchase_return_entries",
                ref_id=entry.id,
                qty_in=0,
                qty_out=it.quantity,
                unit_cost=it.price,
                value_in=0,
                value_out=line_total,
                balance=item.current_stock,
                current_value=item.current_stock * it.price,
                created_at=now,
                updated_at=now,
                created_by=current_user.id,
                updated_by=current_user.id
            ))
            
    db.commit()
    db.refresh(entry)
    return entry

def get_vendor_bills(vendor_id: int, db: Session):
    return db.query(PurchaseEntry).filter(
        PurchaseEntry.vendor_id == vendor_id,
        PurchaseEntry.status == 1
    ).order_by(PurchaseEntry.purchase_date.desc()).all()

def get_bill_items(purchase_id: int, db: Session):
    return db.query(PurchaseItem).options(joinedload(PurchaseItem.item)).filter(
        PurchaseItem.purchase_entry_id == purchase_id
    ).all()


def _reverse_purchase_return_effects(entry: PurchaseReturnEntry, db: Session):
    now = datetime.now(timezone.utc)
    for it in entry.items:
        item = db.query(Item).filter(Item.id == it.item_id).first()
        if item:
            item.current_stock += it.quantity
            item.updated_at = now
    db.query(StockLedger).filter(
        StockLedger.ref_table == "purchase_return_entries",
        StockLedger.ref_id == entry.id
    ).update({"status": 0}, synchronize_session=False)


def update_purchase_return(return_id: int, payload, db: Session, current_user: User):
    now = datetime.now(timezone.utc)
    entry = db.query(PurchaseReturnEntry).options(joinedload(PurchaseReturnEntry.items)).filter(
        PurchaseReturnEntry.id == return_id,
        PurchaseReturnEntry.status == 1
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Purchase return not found")

    _reverse_purchase_return_effects(entry, db)
    db.query(PurchaseReturnItem).filter(PurchaseReturnItem.return_entry_id == entry.id).delete()

    total_amount = Decimal("0")
    for it in payload.items:
        total_amount += it.quantity * it.price

    entry.return_date = payload.return_date
    entry.vendor_id = payload.vendor_id
    entry.purchase_entry_id = payload.purchase_entry_id
    entry.total_return_amount = total_amount
    entry.remarks = payload.remarks
    entry.updated_at = now
    entry.updated_by = current_user.id

    for it in payload.items:
        line_total = it.quantity * it.price
        return_item = PurchaseReturnItem(
            return_entry_id=entry.id,
            item_id=it.item_id,
            quantity=it.quantity,
            price=it.price,
            line_total=line_total,
            created_at=now
        )
        db.add(return_item)

        item = db.query(Item).filter(Item.id == it.item_id).first()
        if item:
            item.current_stock -= it.quantity
            item.updated_at = now
            db.add(StockLedger(
                item_id=item.id,
                txn_date=payload.return_date,
                txn_type=5,
                ref_table="purchase_return_entries",
                ref_id=entry.id,
                qty_in=0,
                qty_out=it.quantity,
                unit_cost=it.price,
                value_in=0,
                value_out=line_total,
                balance=item.current_stock,
                current_value=item.current_stock * it.price,
                status=1,
                created_at=now,
                updated_at=now,
                created_by=current_user.id,
                updated_by=current_user.id
            ))

    db.commit()
    db.refresh(entry)
    return entry


def delete_purchase_return(return_id: int, db: Session, current_user: User):
    now = datetime.now(timezone.utc)
    entry = db.query(PurchaseReturnEntry).options(joinedload(PurchaseReturnEntry.items)).filter(
        PurchaseReturnEntry.id == return_id,
        PurchaseReturnEntry.status == 1
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Purchase return not found")

    _reverse_purchase_return_effects(entry, db)
    entry.status = 0
    entry.updated_at = now
    entry.updated_by = current_user.id
    db.commit()

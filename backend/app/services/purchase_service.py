from datetime import datetime, timezone
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.db.models import Item, PurchaseEntry, PurchaseItem, StockLedger, User, Vendor
from app.schemas.purchase import PurchaseEntryCreate, PurchaseEntryUpdate

def list_purchases(db: Session, page: int = 1, page_size: int = 20, q: str = None, status: int = None, search_field: str = None):
    query = db.query(PurchaseEntry).options(joinedload(PurchaseEntry.items), joinedload(PurchaseEntry.vendor), joinedload(PurchaseEntry.user))
    if status is not None: query = query.filter(PurchaseEntry.status == status)
    return query.order_by(PurchaseEntry.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

def create_purchase(payload: PurchaseEntryCreate, db: Session, current_user: User) -> PurchaseEntry:
    now = datetime.now(timezone.utc)
    total = Decimal("0")
    for it in payload.items: total += it.quantity * it.price
    next_entry_id = (db.query(func.max(PurchaseEntry.id)).scalar() or 0) + 1
    entry = PurchaseEntry(id=next_entry_id, vendor_id=payload.vendor_id, purchase_date=payload.purchase_date, bill_no=payload.bill_no, total_amount=total, user_id=payload.user_id, status=payload.status, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id)
    db.add(entry); db.flush()
    entry_id = entry.id
    for it in payload.items:
        item = db.query(Item).filter(Item.id == it.item_id).first()
        line_total = it.quantity * it.price
        db.add(PurchaseItem(purchase_entry_id=entry_id, purchase_date=payload.purchase_date, item_id=it.item_id, quantity=it.quantity, price=it.price, line_total=line_total, status=1, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id))
        item.current_stock += it.quantity
        db.add(StockLedger(item_id=item.id, txn_date=payload.purchase_date, txn_type=1, ref_table="purchase_entries", ref_id=entry_id, qty_in=it.quantity, qty_out=0, unit_cost=it.price, value_in=line_total, value_out=0, balance=item.current_stock, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id))
    db.commit(); return entry

def get_purchase(purchase_id: int, db: Session) -> PurchaseEntry:
    entry = db.query(PurchaseEntry).filter(PurchaseEntry.id == purchase_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Not found")
    return entry

def get_purchase_full(purchase_id: int, db: Session) -> dict:
    entry = db.query(PurchaseEntry).options(joinedload(PurchaseEntry.user)).filter(PurchaseEntry.id == purchase_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Not found")
    items = db.query(PurchaseItem).filter(PurchaseItem.purchase_entry_id == purchase_id, PurchaseItem.purchase_date == entry.purchase_date).all()
    return {"id": entry.id, "purchase_date": entry.purchase_date, "total_amount": entry.total_amount, "items": [{"id": i.id, "item_id": i.item_id, "quantity": i.quantity, "price": i.price} for i in items]}

def delete_purchase(purchase_id: int, db: Session, current_user: User) -> None:
    entry = get_purchase(purchase_id, db)
    db.query(PurchaseItem).filter(PurchaseItem.purchase_entry_id == purchase_id, PurchaseItem.purchase_date == entry.purchase_date).delete()
    db.query(StockLedger).filter(StockLedger.ref_table == "purchase_entries", StockLedger.ref_id == purchase_id, StockLedger.txn_date == entry.purchase_date).delete()
    db.delete(entry); db.commit()

def update_purchase(purchase_id: int, payload: PurchaseEntryUpdate, db: Session, current_user: User) -> dict:
    delete_purchase(purchase_id, db, current_user)
    new_entry = create_purchase(payload, db, current_user)
    return get_purchase_full(new_entry.id, db)


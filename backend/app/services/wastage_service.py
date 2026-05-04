from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from app.db.models import Item, StockLedger, User, WastageEntry, WastageItem
from app.schemas.wastage import WastageEntryCreate, WastageEntryUpdate
from app.services.item_service import get_item_last_price

def list_wastages(db: Session, page: int = 1, page_size: int = 20, q: str = None, status: int = None, search_field: str = None):
    query = db.query(WastageEntry).options(joinedload(WastageEntry.items), joinedload(WastageEntry.user))
    if status is not None: query = query.filter(WastageEntry.status == status)
    return query.order_by(WastageEntry.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

def create_wastage(payload: WastageEntryCreate, db: Session, current_user: User) -> WastageEntry:
    now = datetime.now(timezone.utc)
    entry = WastageEntry(wastage_date=payload.wastage_date, reason=payload.reason, user_id=payload.user_id, status=payload.status, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id)
    db.add(entry); db.flush()
    for it in payload.items:
        item = db.query(Item).filter(Item.id == it.item_id).first()
        unit_cost = it.unit_cost_at_time or get_item_last_price(it.item_id, db)
        db.add(WastageItem(wastage_entry_id=entry.id, wastage_date=payload.wastage_date, item_id=it.item_id, quantity=it.quantity, unit_cost_at_time=unit_cost, line_total=it.quantity * unit_cost, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id))
        item.current_stock -= it.quantity
        db.add(StockLedger(item_id=item.id, txn_date=payload.wastage_date, txn_type=3, ref_table="wastage_entries", ref_id=entry.id, qty_in=0, qty_out=it.quantity, unit_cost=unit_cost, value_in=0, value_out=it.quantity * unit_cost, balance=item.current_stock, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id))
    db.commit(); db.refresh(entry); return entry

def get_wastage(wastage_id: int, db: Session) -> WastageEntry:
    entry = db.query(WastageEntry).filter(WastageEntry.id == wastage_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Not found")
    return entry

def get_wastage_full(wastage_id: int, db: Session) -> WastageEntry:
    entry = db.query(WastageEntry).options(
        joinedload(WastageEntry.user),
        joinedload(WastageEntry.items)
    ).filter(WastageEntry.id == wastage_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Not found")
    return entry

def delete_wastage(wastage_id: int, db: Session, current_user: User) -> None:
    entry = get_wastage(wastage_id, db)
    db.query(WastageItem).filter(WastageItem.wastage_entry_id == wastage_id, WastageItem.wastage_date == entry.wastage_date).delete()
    db.query(StockLedger).filter(StockLedger.ref_table == "wastage_entries", StockLedger.ref_id == wastage_id, StockLedger.txn_date == entry.wastage_date).delete()
    db.delete(entry); db.commit()

def update_wastage(wastage_id: int, payload: WastageEntryUpdate, db: Session, current_user: User) -> dict:
    delete_wastage(wastage_id, db, current_user)
    new_entry = create_wastage(payload, db, current_user)
    return get_wastage_full(new_entry.id, db)

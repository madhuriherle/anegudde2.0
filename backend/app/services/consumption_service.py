from datetime import datetime, timezone
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import String
from sqlalchemy.orm import Session, joinedload
from app.db.models import Chef, ConsumptionEntry, ConsumptionItem, Item, Notification, StockLedger, User
from app.schemas.consumption import ConsumptionEntryCreate, ConsumptionEntryUpdate
from app.services.item_service import get_item_last_price

def list_consumptions(db: Session, page: int = 1, page_size: int = 20, q: str = None, status: int = None, search_field: str = None):
    query = db.query(ConsumptionEntry).options(joinedload(ConsumptionEntry.items), joinedload(ConsumptionEntry.chef), joinedload(ConsumptionEntry.user))
    if status is not None: query = query.filter(ConsumptionEntry.status == status)
    if q:
        like = f"%{q}%"
        if search_field == "chef": query = query.join(Chef).filter(Chef.chef_name.ilike(like))
        else: query = query.filter(ConsumptionEntry.id.cast(String).ilike(like))
    return query.order_by(ConsumptionEntry.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

def create_consumption(payload: ConsumptionEntryCreate, db: Session, current_user: User) -> ConsumptionEntry:
    now = datetime.now(timezone.utc)
    entry = ConsumptionEntry(usage_date=payload.usage_date, people_served=payload.people_served, chef_id=payload.chef_id, user_id=payload.user_id, status=payload.status, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id)
    db.add(entry); db.flush()
    for it in payload.items:
        item = db.query(Item).filter(Item.id == it.item_id).first()
        unit_cost = it.unit_cost_at_time or get_item_last_price(it.item_id, db)
        db.add(ConsumptionItem(consumption_entry_id=entry.id, usage_date=payload.usage_date, item_id=it.item_id, quantity_used=it.quantity_used, unit_cost_at_time=unit_cost, line_total=it.quantity_used * unit_cost, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id))
        item.current_stock -= it.quantity_used
        db.add(StockLedger(item_id=item.id, txn_date=payload.usage_date, txn_type=2, ref_table="consumption_entries", ref_id=entry.id, qty_in=0, qty_out=it.quantity_used, unit_cost=unit_cost, value_in=0, value_out=it.quantity_used * unit_cost, balance=item.current_stock, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id))
    db.commit(); db.refresh(entry); return entry

def get_consumption(consumption_id: int, db: Session) -> ConsumptionEntry:
    entry = db.query(ConsumptionEntry).filter(ConsumptionEntry.id == consumption_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Not found")
    return entry

def get_consumption_full(consumption_id: int, db: Session) -> ConsumptionEntry:
    entry = db.query(ConsumptionEntry).options(
        joinedload(ConsumptionEntry.user),
        joinedload(ConsumptionEntry.items),
        joinedload(ConsumptionEntry.chef)
    ).filter(ConsumptionEntry.id == consumption_id).first()
    if not entry: raise HTTPException(status_code=404, detail="Not found")
    return entry

def delete_consumption(consumption_id: int, db: Session, current_user: User) -> None:
    entry = get_consumption(consumption_id, db)
    db.query(ConsumptionItem).filter(ConsumptionItem.consumption_entry_id == consumption_id, ConsumptionItem.usage_date == entry.usage_date).delete()
    db.query(StockLedger).filter(StockLedger.ref_table == "consumption_entries", StockLedger.ref_id == consumption_id, StockLedger.txn_date == entry.usage_date).delete()
    db.delete(entry); db.commit()

def update_consumption(consumption_id: int, payload: ConsumptionEntryUpdate, db: Session, current_user: User) -> dict:
    delete_consumption(consumption_id, db, current_user)
    new_entry = create_consumption(payload, db, current_user)
    return get_consumption_full(new_entry.id, db)

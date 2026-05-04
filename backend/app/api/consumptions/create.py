from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import Chef, ConsumptionEntry, ConsumptionItem, Item, Notification, StockLedger, User
from app.schemas.consumption import ConsumptionEntryCreate, ConsumptionEntryOut
router = APIRouter()
@router.post("/", response_model=ConsumptionEntryOut, status_code=status.HTTP_201_CREATED)
def create_consumption(payload: ConsumptionEntryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not db.query(User).filter(User.id == payload.user_id).first(): raise HTTPException(status_code=400, detail="Invalid user_id")
    if payload.chef_id and not db.query(Chef).filter(Chef.id == payload.chef_id).first(): raise HTTPException(status_code=400, detail="Invalid chef_id")
    if not payload.items: raise HTTPException(status_code=400, detail="At least one consumption item is required")
    now = datetime.now(timezone.utc); item_map: dict[int, Item] = {}
    for it in payload.items:
        item = db.query(Item).filter(Item.id == it.item_id).first()
        if not item: raise HTTPException(status_code=400, detail=f"Invalid item_id: {it.item_id}")
        if (item.current_stock or Decimal("0")) < it.quantity_used: raise HTTPException(status_code=400, detail=f"Insufficient stock for item_id {it.item_id}")
        item_map[it.item_id] = item
    # Composite PK table does not auto-generate id reliably; generate sequential id in app.
    next_entry_id = (db.query(func.max(ConsumptionEntry.id)).scalar() or 0) + 1
    entry = ConsumptionEntry(id=next_entry_id, usage_date=payload.usage_date, people_served=payload.people_served, chef_id=payload.chef_id, user_id=payload.user_id, status=payload.status, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id)
    db.add(entry); db.flush()
    entry_id = entry.id
    for it in payload.items:
        item = item_map[it.item_id]; unit_cost = it.unit_cost_at_time or Decimal("0"); line_total = it.quantity_used * unit_cost
        db.add(ConsumptionItem(
            consumption_entry_id=entry.id,
            usage_date=payload.usage_date,
            item_id=it.item_id,
            quantity_used=it.quantity_used,
            unit_cost_at_time=it.unit_cost_at_time,
            line_total=line_total,
            created_at=now,
            updated_at=now,
            created_by=current_user.id,
            updated_by=current_user.id
        ))
        item.current_stock = (item.current_stock or Decimal("0")) - it.quantity_used; item.updated_at = now; item.updated_by = current_user.id
        db.add(StockLedger(item_id=item.id, txn_date=payload.usage_date, txn_type=2, ref_table="consumption_entries", ref_id=entry.id, qty_in=Decimal("0"), qty_out=it.quantity_used, unit_cost=unit_cost, value_in=Decimal("0"), value_out=line_total, balance=item.current_stock, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id))
        if item.min_stock_level is not None and item.current_stock < item.min_stock_level:
            existing = db.query(Notification).filter(Notification.title.like(f"Low Stock: {item.item_name}%"), Notification.is_read == 0).first()
            if not existing:
                db.add(Notification(title=f"Low Stock: {item.item_name}", message=f"Current stock ({item.current_stock}) is below the minimum level ({item.min_stock_level}). Please reorder soon.", notification_type="warning", link="/items"))
    db.commit()
    # Avoid ORM refresh/reload issues with composite PK + partitioned tables.
    return ConsumptionEntryOut(
        id=entry_id,
        usage_date=payload.usage_date,
        people_served=payload.people_served,
        chef_id=payload.chef_id,
        user_id=payload.user_id,
        status=payload.status,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id,
    )


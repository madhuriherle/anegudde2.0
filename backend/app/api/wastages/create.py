from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import Item, StockLedger, User, WastageEntry, WastageItem
from app.schemas.wastage import WastageEntryCreate, WastageEntryOut
router = APIRouter()
@router.post("/", response_model=WastageEntryOut, status_code=status.HTTP_201_CREATED)
def create_wastage(payload: WastageEntryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not db.query(User).filter(User.id == payload.user_id).first(): raise HTTPException(status_code=400, detail="Invalid user_id")
    if not payload.items: raise HTTPException(status_code=400, detail="At least one wastage item is required")
    now = datetime.now(timezone.utc); item_map: dict[int, Item] = {}
    for it in payload.items:
        item = db.query(Item).filter(Item.id == it.item_id).first()
        if not item: raise HTTPException(status_code=400, detail=f"Invalid item_id: {it.item_id}")
        if (item.current_stock or Decimal("0")) < it.quantity: raise HTTPException(status_code=400, detail=f"Insufficient stock for item_id {it.item_id}")
        item_map[it.item_id] = item
    next_entry_id = (db.query(func.max(WastageEntry.id)).scalar() or 0) + 1
    entry = WastageEntry(id=next_entry_id, wastage_date=payload.wastage_date, reason=payload.reason, user_id=payload.user_id, status=payload.status, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id)
    db.add(entry); db.flush()
    entry_id = entry.id
    for it in payload.items:
        item = item_map[it.item_id]; unit_cost = it.unit_cost_at_time or Decimal("0"); line_total = it.quantity * unit_cost
        db.add(WastageItem(item_id=it.item_id, wastage_entry_id=entry_id, wastage_date=payload.wastage_date, quantity=it.quantity, unit_cost_at_time=it.unit_cost_at_time, line_total=line_total, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id))
        item.current_stock = (item.current_stock or Decimal("0")) - it.quantity; item.updated_at = now; item.updated_by = current_user.id
        db.add(StockLedger(item_id=item.id, txn_date=payload.wastage_date, txn_type=3, ref_table="wastage_entries", ref_id=entry_id, qty_in=Decimal("0"), qty_out=it.quantity, unit_cost=unit_cost, value_in=Decimal("0"), value_out=line_total, balance=item.current_stock, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id))
    db.commit()
    return WastageEntryOut(
        id=entry_id,
        wastage_date=payload.wastage_date,
        reason=payload.reason,
        user_id=payload.user_id,
        status=payload.status,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id,
    )


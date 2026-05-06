from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import Item, StockAdjustment, StockLedger, User
from app.schemas.stock_adjustment import StockAdjustmentCreate, StockAdjustmentOut
router = APIRouter()
@router.post("/create_adjustment", response_model=StockAdjustmentOut, status_code=status.HTTP_201_CREATED)
def create_adjustment(payload: StockAdjustmentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(Item).filter(Item.id == payload.item_id).first()
    if not item: raise HTTPException(status_code=400, detail="Invalid item_id")
    now = datetime.now(timezone.utc)
    
    adjustment = StockAdjustment(**payload.model_dump(), user_id=current_user.id, created_at=now, created_by=current_user.id)
    db.add(adjustment); db.flush()
    
    item.current_stock = (item.current_stock or Decimal("0")) + payload.adjusted_qty; item.updated_at = now; item.updated_by = current_user.id
    db.add(StockLedger(item_id=item.id, txn_date=payload.adjustment_date, txn_type=4, ref_table="stock_adjustments", ref_id=adjustment.id, qty_in=payload.adjusted_qty if payload.adjusted_qty > 0 else 0, qty_out=abs(payload.adjusted_qty) if payload.adjusted_qty < 0 else 0, unit_cost=item.default_price or 0, value_in=(payload.adjusted_qty * (item.default_price or 0)) if payload.adjusted_qty > 0 else 0, value_out=(abs(payload.adjusted_qty) * (item.default_price or 0)) if payload.adjusted_qty < 0 else 0, balance=item.current_stock, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id))
    db.commit()
    return StockAdjustmentOut(
        id=adjustment.id,
        item_id=payload.item_id,
        adjustment_date=payload.adjustment_date,
        adjusted_qty=payload.adjusted_qty,
        reason=payload.reason,
        user_id=current_user.id,
        created_at=now,
    )


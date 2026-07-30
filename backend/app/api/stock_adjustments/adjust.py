from datetime import datetime, timezone, date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, PermissionChecker
from app.db.models import Item, StockAdjustment, StockLedger, User
from app.utils.stock_ledger_utils import compute_current_value
from app.schemas.stock_adjustment import StandaloneStockAdjustmentCreate

router = APIRouter()

@router.post("/adjust", status_code=status.HTTP_200_OK)
def adjust_stock(
    payload: StandaloneStockAdjustmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("items.write"))
):
    item = db.query(Item).with_for_update().filter(Item.id == payload.item_id, Item.is_deleted == False).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    actual_qty = Decimal(payload.adjusted_qty or 0)
    if actual_qty == 0:
        raise HTTPException(status_code=422, detail="Adjusted quantity cannot be zero")

    current_stock = Decimal(item.current_stock or 0)
    if (current_stock + actual_qty) < 0:
        raise HTTPException(
            status_code=422,
            detail=f"Insufficient stock for '{item.item_name}'. Current stock is {current_stock} but trying to remove {abs(actual_qty)}."
        )

    request.state.audit_meta = {
        "item_id": item.id,
        "item_name": item.item_name,
        "adjusted_qty": str(actual_qty),
        "reason": payload.reason,
    }

    now = datetime.now(timezone.utc)
    today = date.today()

    new_adj = StockAdjustment(
        consumption_entry_id=None,
        adjustment_date=today,
        item_id=item.id,
        adjusted_qty=actual_qty,
        reason=payload.reason or "Manual stock adjustment",
        user_id=current_user.id,
        created_at=now,
        created_by=current_user.id
    )
    db.add(new_adj)
    db.flush()

    item.current_stock = current_stock + actual_qty
    item.updated_at = now
    item.updated_by = current_user.id

    if actual_qty > 0:
        if payload.unit_cost is not None:
            unit_cost = payload.unit_cost
        else:
            unit_cost = item.default_price or Decimal("0")
            if unit_cost <= 0:
                raise HTTPException(status_code=422, detail="This item has no recorded price. Please specify a unit cost for this positive stock adjustment.")
    else:
        unit_cost = item.default_price or Decimal("0")
    db.add(StockLedger(
        item_id=item.id,
        txn_date=today,
        txn_type=4,
        ref_table="stock_adjustments",
        ref_id=new_adj.id,
        qty_in=actual_qty if actual_qty > 0 else 0,
        qty_out=abs(actual_qty) if actual_qty < 0 else 0,
        unit_cost=unit_cost,
        value_in=(actual_qty * unit_cost) if actual_qty > 0 else 0,
        value_out=(abs(actual_qty) * unit_cost) if actual_qty < 0 else 0,
        balance=Decimal(item.current_stock),
        current_value=compute_current_value(db, item.id, (actual_qty if actual_qty > 0 else 0) * unit_cost, (abs(actual_qty) if actual_qty < 0 else 0) * unit_cost),
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id
    ))

    db.commit()
    db.refresh(new_adj)

    return {
        "message": "Stock adjusted successfully",
        "adjustment_id": new_adj.id,
        "item": item.item_name,
        "previous_stock": str(current_stock),
        "new_stock": str(item.current_stock),
        "adjusted_qty": str(actual_qty)
    }

from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import Item, StockAdjustment, StockLedger, User, ConsumptionEntry
from app.utils.stock_ledger_utils import compute_current_value
from app.schemas.stock_adjustment import StockAdjustmentCreate
from typing import List

router = APIRouter()

@router.post("/sync_for_consumption/{consumption_id}", status_code=status.HTTP_200_OK)
def sync_for_consumption(
    consumption_id: int,
    payload: List[StockAdjustmentCreate],
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("daily_usage.write"))
):
    consumption = db.query(ConsumptionEntry).filter(ConsumptionEntry.id == consumption_id).first()
    if not consumption:
        raise HTTPException(status_code=404, detail="Consumption entry not found")

    # Attach snapshot metadata for audit logging
    request.state.audit_meta = {
        "consumption_id": consumption_id,
        "usage_date": consumption.usage_date.isoformat() if consumption.usage_date else None,
        "snapshot": {"consumption_id": consumption_id, "usage_date": consumption.usage_date.isoformat() if consumption.usage_date else None}
    }

    now = datetime.now(timezone.utc)

    # 1. Reverse old adjustments
    old_adjustments = db.query(StockAdjustment).filter(StockAdjustment.consumption_entry_id == consumption_id).all()
    for old in old_adjustments:
        item = db.query(Item).filter(Item.id == old.item_id).first()
        if item:
            # Reverse prior effect regardless of sign
            item.current_stock = Decimal(item.current_stock or 0) - old.adjusted_qty
    
    # Delete old adjustments and their ledger entries
    db.query(StockAdjustment).filter(StockAdjustment.consumption_entry_id == consumption_id).delete()
    db.query(StockLedger).filter(
        StockLedger.ref_table == "stock_adjustments",
        StockLedger.ref_id.in_([a.id for a in old_adjustments])
    ).delete(synchronize_session=False)

    # 2. Apply new adjustments
    for adj in payload:
        item = db.query(Item).filter(Item.id == adj.item_id).first()
        if not item:
            continue

        # Signed quantity from UI:
        # +ve => add stock, -ve => remove stock
        actual_qty = Decimal(adj.adjusted_qty or 0)
        if actual_qty == 0:
            continue

        # Check if adjustment results in negative stock
        current_stock = Decimal(item.current_stock or 0)
        if (current_stock + actual_qty) < 0:
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient stock for item '{item.item_name}'. Current stock is {current_stock} but trying to remove {abs(actual_qty)}."
            )
        
        new_adj = StockAdjustment(
            consumption_entry_id=consumption_id,
            adjustment_date=adj.adjustment_date,
            item_id=adj.item_id,
            adjusted_qty=actual_qty,
            reason=adj.reason or f"Linked to Usage Entry #{consumption_id}",
            user_id=current_user.id,
            created_at=now,
            created_by=current_user.id
        )
        db.add(new_adj)
        db.flush()

        item.current_stock = Decimal(item.current_stock or 0) + actual_qty
        item.updated_at = now
        item.updated_by = current_user.id

        unit_cost = item.default_price or 0
        db.add(StockLedger(
            item_id=item.id,
            txn_date=adj.adjustment_date,
            txn_type=4, # Stock Adjustment
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
    return {"message": "Stock adjustments synchronized successfully"}

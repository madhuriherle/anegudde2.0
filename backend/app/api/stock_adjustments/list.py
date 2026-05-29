from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import StockAdjustment, User
from app.schemas.stock_adjustment import StockAdjustmentOut
router = APIRouter()
@router.get("/list_adjustments", response_model=list[StockAdjustmentOut])
def list_adjustments(
    consumption_entry_id: int | None = None,
    db: Session = Depends(get_db), 
    _: User = Depends(PermissionChecker("consumptions.read"))
):
    query = db.query(StockAdjustment)
    if consumption_entry_id:
        query = query.filter(StockAdjustment.consumption_entry_id == consumption_entry_id)
    return query.order_by(StockAdjustment.id.desc()).all()


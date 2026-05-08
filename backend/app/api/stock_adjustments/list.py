from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import StockAdjustment, User
from app.schemas.stock_adjustment import StockAdjustmentOut
router = APIRouter()
@router.get("/list_adjustments", response_model=list[StockAdjustmentOut])
def list_adjustments(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(StockAdjustment).order_by(StockAdjustment.id.desc()).all()


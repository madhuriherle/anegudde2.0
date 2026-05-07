from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, get_financial_year
from app.db.models import StockAdjustment, User, FinancialYear
from app.schemas.stock_adjustment import StockAdjustmentOut
router = APIRouter()
@router.get("/list_adjustments", response_model=list[StockAdjustmentOut])
def list_adjustments(db: Session = Depends(get_db), _: User = Depends(get_current_user), financial_year: FinancialYear = Depends(get_financial_year)):
    return db.query(StockAdjustment).filter(StockAdjustment.financial_year_id == financial_year.id).order_by(StockAdjustment.id.desc()).all()


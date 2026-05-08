from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
import logging

from app.api.deps import get_current_user, get_db
from app.db.models import DailyStockSummary, User

router = APIRouter()

@router.get("/get_stock_trend")
def stock_trend(
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user)
):
    thirty_days_ago = date.today() - timedelta(days=30)
    results = (
        db.query(
            DailyStockSummary.summary_date,
            func.sum(DailyStockSummary.stock_value).label("total_value"),
        )
        .filter(
            DailyStockSummary.summary_date >= thirty_days_ago
        )
        .group_by(DailyStockSummary.summary_date)
        .order_by(DailyStockSummary.summary_date.asc())
        .all()
    )
    
    if not results:
        return []
        
    return [{"date": r.summary_date, "value": r.total_value} for r in results]

@router.post("/backfill_stock_trend")
def backfill_trend(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    from app.utils.tasks import generate_daily_stock_summary
    from datetime import date, timedelta
    
    logger = logging.getLogger(__name__)
    
    try:
        # Backfill last 30 days
        start_date = date.today() - timedelta(days=30)
        for i in range(31):
            target_date = start_date + timedelta(days=i)
            generate_daily_stock_summary(target_date)
            
        return {"message": "Trend data backfilled successfully"}
    except Exception as e:
        logger.error(f"Backfill failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Backfill failed: {str(e)}")

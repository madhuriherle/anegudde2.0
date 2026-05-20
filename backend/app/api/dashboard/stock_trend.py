from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
import logging

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import DailyStockSummary, StockLedger, User

router = APIRouter()

@router.get("/get_stock_trend")
def stock_trend(
    db: Session = Depends(get_db), 
    _: User = Depends(PermissionChecker("dashboard.read"))
):
    today = date.today()
    thirty_days_ago = today - timedelta(days=30)
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
    
    if results:
        return [{"date": r.summary_date, "value": r.total_value} for r in results]

    # Fallback: build daily closing value trend from stock_ledger.
    # For each day, sum the latest `current_value` per item as of end-of-day.
    baseline_rows = (
        db.query(
            StockLedger.item_id,
            func.max(StockLedger.id).label("max_id"),
        )
        .filter(
            StockLedger.status == 1,
            StockLedger.txn_date < thirty_days_ago,
        )
        .group_by(StockLedger.item_id)
        .all()
    )
    baseline_id_map = {r.item_id: r.max_id for r in baseline_rows}
    baseline_values = {}
    if baseline_id_map:
        ids = list(baseline_id_map.values())
        for row in db.query(StockLedger.id, StockLedger.item_id, StockLedger.current_value).filter(StockLedger.id.in_(ids)).all():
            baseline_values[row.item_id] = float(row.current_value or 0)

    movement_rows = (
        db.query(
            StockLedger.item_id,
            StockLedger.txn_date,
            StockLedger.id,
            StockLedger.current_value,
        )
        .filter(
            StockLedger.status == 1,
            StockLedger.txn_date >= thirty_days_ago,
            StockLedger.txn_date <= today,
        )
        .order_by(StockLedger.txn_date.asc(), StockLedger.id.asc())
        .all()
    )

    by_date: dict[date, list[tuple[int, float]]] = {}
    for row in movement_rows:
        by_date.setdefault(row.txn_date, []).append((row.item_id, float(row.current_value or 0)))

    current_by_item = dict(baseline_values)
    trend = []
    day = thirty_days_ago
    while day <= today:
        for item_id, curr_val in by_date.get(day, []):
            current_by_item[item_id] = curr_val
        total_value = sum(current_by_item.values()) if current_by_item else 0.0
        trend.append({"date": day, "value": total_value})
        day += timedelta(days=1)

    return trend

@router.post("/backfill_stock_trend")
def backfill_trend(db: Session = Depends(get_db), _: User = Depends(PermissionChecker("dashboard.read"))):
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

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import DailyStockSummary, Item, User

router = APIRouter()


@router.get("/daily-closing-stock")
def get_daily_closing_stock(target_date: date = Query(...), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    results = (
        db.query(DailyStockSummary, Item.item_name)
        .join(Item, Item.id == DailyStockSummary.item_id)
        .filter(DailyStockSummary.summary_date == target_date)
        .all()
    )
    return [
        {
            "id": r.DailyStockSummary.id,
            "item_name": r.item_name,
            "opening_stock": r.DailyStockSummary.opening_stock,
            "purchased_qty": r.DailyStockSummary.purchased_qty,
            "consumed_qty": r.DailyStockSummary.consumed_qty,
            "wastage_qty": r.DailyStockSummary.wastage_qty,
            "adjustment_qty": r.DailyStockSummary.adjustment_qty,
            "closing_stock": r.DailyStockSummary.closing_stock,
            "stock_value": r.DailyStockSummary.stock_value,
        }
        for r in results
    ]

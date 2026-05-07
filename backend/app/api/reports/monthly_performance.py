from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_financial_year
from app.db.models import Item, MonthlyStockSummary, User, FinancialYear

router = APIRouter()


@router.get("/monthly-performance")
def monthly_performance_report(
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user),
    financial_year: FinancialYear = Depends(get_financial_year)
):
    results = (
        db.query(MonthlyStockSummary, Item.item_name)
        .join(Item, Item.id == MonthlyStockSummary.item_id)
        .filter(MonthlyStockSummary.financial_year_id == financial_year.id)
        .order_by(MonthlyStockSummary.summary_month.desc(), Item.item_name.asc())
        .all()
    )
    return [
        {
            "id": r.MonthlyStockSummary.id,
            "month": r.MonthlyStockSummary.summary_month,
            "item_name": r.item_name,
            "opening_stock": r.MonthlyStockSummary.opening_stock,
            "total_purchased": r.MonthlyStockSummary.total_purchased_qty,
            "total_consumed": r.MonthlyStockSummary.total_consumed_qty,
            "total_wastage": r.MonthlyStockSummary.total_wastage_qty,
            "total_adjustment": r.MonthlyStockSummary.total_adjustment_qty,
            "closing_stock": r.MonthlyStockSummary.closing_stock,
            "stock_value": r.MonthlyStockSummary.closing_stock_value,
        }
        for r in results
    ]

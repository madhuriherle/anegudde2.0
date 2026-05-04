from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import StockLedger, User
from app.schemas.report import StockReportRow
from .common import period_expr

router = APIRouter()


@router.get("/stock-summary", response_model=list[StockReportRow])
def stock_summary_report(from_date: date = Query(...), to_date: date = Query(...), group_by: str = Query("day"), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    period = period_expr(group_by, StockLedger.txn_date)
    rows = (
        db.query(
            period.label("period"),
            func.coalesce(func.sum(StockLedger.qty_in), 0).label("qty_in"),
            func.coalesce(func.sum(StockLedger.qty_out), 0).label("qty_out"),
            func.coalesce(func.sum(StockLedger.value_in), 0).label("value_in"),
            func.coalesce(func.sum(StockLedger.value_out), 0).label("value_out"),
        )
        .filter(StockLedger.txn_date >= from_date, StockLedger.txn_date <= to_date)
        .group_by(period)
        .order_by(period)
        .all()
    )
    return [StockReportRow(period=r.period, qty_in=r.qty_in, qty_out=r.qty_out, value_in=r.value_in, value_out=r.value_out) for r in rows]

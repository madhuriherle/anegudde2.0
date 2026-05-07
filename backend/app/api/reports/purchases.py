from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_financial_year
from app.db.models import PurchaseEntry, User, FinancialYear
from app.schemas.report import ReportRow
from .common import period_expr

router = APIRouter()


@router.get("/purchases", response_model=list[ReportRow])
def purchases_report(
    from_date: date = Query(...), 
    to_date: date = Query(...), 
    group_by: str = Query("day"), 
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user),
    financial_year: FinancialYear = Depends(get_financial_year)
):
    period = period_expr(group_by, PurchaseEntry.purchase_date)
    rows = (
        db.query(period.label("period"), func.coalesce(func.sum(PurchaseEntry.total_amount), 0).label("total_amount"), func.count(PurchaseEntry.id).label("total_count"))
        .filter(
            PurchaseEntry.purchase_date >= from_date, 
            PurchaseEntry.purchase_date <= to_date,
            PurchaseEntry.financial_year_id == financial_year.id
        )
        .group_by(period)
        .order_by(period)
        .all()
    )
    return [ReportRow(period=r.period, total_amount=r.total_amount, total_count=r.total_count) for r in rows]

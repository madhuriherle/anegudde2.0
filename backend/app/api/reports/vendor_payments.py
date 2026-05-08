from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User, VendorPayment
from app.schemas.report import ReportRow
from .common import period_expr

router = APIRouter()


@router.get("/get_vendor_payments_report", response_model=list[ReportRow])
def vendor_payments_report(
    from_date: date = Query(...), 
    to_date: date = Query(...), 
    group_by: str = Query("day"), 
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user)
):
    period = period_expr(group_by, VendorPayment.payment_date)
    rows = (
        db.query(period.label("period"), func.coalesce(func.sum(VendorPayment.amount), 0).label("total_amount"), func.count(VendorPayment.id).label("total_count"))
        .filter(
            VendorPayment.payment_date >= from_date, 
            VendorPayment.payment_date <= to_date
        )
        .group_by(period)
        .order_by(period)
        .all()
    )
    return [ReportRow(period=r.period, total_amount=r.total_amount, total_count=r.total_count) for r in rows]

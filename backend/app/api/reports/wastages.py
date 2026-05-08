from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User, WastageEntry
from app.schemas.report import ReportRow
from .common import period_expr

router = APIRouter()


@router.get("/get_wastages_report", response_model=list[ReportRow])
def wastages_report(
    from_date: date = Query(...), 
    to_date: date = Query(...), 
    group_by: str = Query("day"), 
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user)
):
    period = period_expr(group_by, WastageEntry.wastage_date)
    rows = (
        db.query(period.label("period"), func.count(WastageEntry.id).label("total_amount"), func.count(WastageEntry.id).label("total_count"))
        .filter(
            WastageEntry.wastage_date >= from_date, 
            WastageEntry.wastage_date <= to_date
        )
        .group_by(period)
        .order_by(period)
        .all()
    )
    return [ReportRow(period=r.period, total_amount=r.total_amount, total_count=r.total_count) for r in rows]

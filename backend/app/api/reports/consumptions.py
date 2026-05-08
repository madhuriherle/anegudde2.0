from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import ConsumptionEntry, StockLedger, User
from app.schemas.report import ReportRow
from .common import period_expr

router = APIRouter()


@router.get("/get_consumptions_report", response_model=list[ReportRow])
def consumptions_report(
    from_date: date = Query(...), 
    to_date: date = Query(...), 
    group_by: str = Query("day"), 
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user)
):
    period = period_expr(group_by, ConsumptionEntry.usage_date)
    rows = (
        db.query(period.label("period"), func.coalesce(func.sum(ConsumptionEntry.people_served), 0).label("total_amount"), func.count(ConsumptionEntry.id).label("total_count"))
        .filter(
            ConsumptionEntry.usage_date >= from_date, 
            ConsumptionEntry.usage_date <= to_date
        )
        .group_by(period)
        .order_by(period)
        .all()
    )
    return [ReportRow(period=r.period, total_amount=r.total_amount, total_count=r.total_count) for r in rows]


@router.get("/get_cooked_remained_totals")
def cooked_remained_totals(
    from_date: date = Query(...), 
    to_date: date = Query(...), 
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user)
):
    row = (
        db.query(
            func.coalesce(func.sum(ConsumptionEntry.anna_remained), 0).label("anna_remained"),
            func.coalesce(func.sum(ConsumptionEntry.saru_remained), 0).label("saru_remained"),
            func.coalesce(func.sum(ConsumptionEntry.huli_remained), 0).label("huli_remained"),
            func.coalesce(func.sum(ConsumptionEntry.payas_remained), 0).label("payas_remained"),
            func.count(ConsumptionEntry.id).label("entry_count"),
        )
        .filter(
            ConsumptionEntry.usage_date >= from_date, 
            ConsumptionEntry.usage_date <= to_date
        )
        .first()
    )
    return {
        "from_date": from_date,
        "to_date": to_date,
        "anna_remained": row.anna_remained,
        "saru_remained": row.saru_remained,
        "huli_remained": row.huli_remained,
        "payas_remained": row.payas_remained,
        "entry_count": row.entry_count,
    }


@router.get("/get_raw_stock_movement")
def raw_stock_movement(
    from_date: date = Query(...), 
    to_date: date = Query(...), 
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user)
):
    issue_qty = (
        db.query(func.coalesce(func.sum(StockLedger.qty_out), 0))
        .filter(
            StockLedger.txn_date >= from_date,
            StockLedger.txn_date <= to_date,
            StockLedger.ref_table == "consumption_entries:RAW_ISSUE"
        )
        .scalar()
    )
    return_qty = (
        db.query(func.coalesce(func.sum(StockLedger.qty_in), 0))
        .filter(
            StockLedger.txn_date >= from_date,
            StockLedger.txn_date <= to_date,
            StockLedger.ref_table == "consumption_entries:RAW_RETURN"
        )
        .scalar()
    )
    return {
        "from_date": from_date,
        "to_date": to_date,
        "issued_qty": issue_qty,
        "returned_qty": return_qty,
        "net_consumed_qty": issue_qty - return_qty,
    }

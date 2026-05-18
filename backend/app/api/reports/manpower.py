from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User, ConsumptionEntry
from app.schemas.report import ManpowerReportRow, ManpowerReportResponse
from .common import period_expr

router = APIRouter()

@router.get("/get_manpower_summary", response_model=ManpowerReportResponse)
def manpower_summary_report(
    from_date: date,
    to_date: date,
    group_by: str = "month",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    try:
        # Dialect-agnostic period expression
        if db.bind.dialect.name == 'sqlite':
            if group_by == "day":
                period = func.strftime("%Y-%m-%d", ConsumptionEntry.usage_date)
            elif group_by == "month":
                period = func.strftime("%Y-%m", ConsumptionEntry.usage_date)
            elif group_by == "year":
                period = func.strftime("%Y", ConsumptionEntry.usage_date)
            else:
                raise HTTPException(status_code=400, detail="group_by must be day, month, or year")
        else:
            # Assume Postgres or other that supports to_char
            period = period_expr(group_by, ConsumptionEntry.usage_date)
        
        rows = (
            db.query(
                period.label("period"),
                func.sum(ConsumptionEntry.regular_cooking_persons).label("regular_cooking"),
                func.sum(ConsumptionEntry.additional_cooking_persons).label("additional_cooking"),
                func.sum(ConsumptionEntry.total_cooking_persons).label("total_cooking"),
                func.sum(ConsumptionEntry.regular_serving_persons).label("regular_serving"),
                func.sum(ConsumptionEntry.additional_serving_persons).label("additional_serving"),
                func.sum(ConsumptionEntry.total_serving_persons).label("total_serving"),
                func.sum(ConsumptionEntry.regular_cleaning_persons).label("regular_cleaning"),
                func.sum(ConsumptionEntry.additional_cleaning_persons).label("additional_cleaning"),
                func.sum(ConsumptionEntry.total_cleaning_persons).label("total_cleaning"),
            )
            .filter(
                ConsumptionEntry.usage_date >= from_date,
                ConsumptionEntry.usage_date <= to_date,
                ConsumptionEntry.status == 1
            )
            .group_by(period)
            .order_by(period)
            .all()
        )
        
        report_rows = []
        for r in rows:
            report_rows.append(ManpowerReportRow(
                period=str(r.period),
                regular_cooking=int(r.regular_cooking or 0),
                additional_cooking=int(r.additional_cooking or 0),
                total_cooking=int(r.total_cooking or 0),
                regular_serving=int(r.regular_serving or 0),
                additional_serving=int(r.additional_serving or 0),
                total_serving=int(r.total_serving or 0),
                regular_cleaning=int(r.regular_cleaning or 0),
                additional_cleaning=int(r.additional_cleaning or 0),
                total_cleaning=int(r.total_cleaning or 0),
            ))
        
        return ManpowerReportResponse(
            from_date=from_date,
            to_date=to_date,
            rows=report_rows
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=str(e))

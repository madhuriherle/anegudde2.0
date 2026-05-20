from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import User, ConsumptionEntry
from app.schemas.report import ManpowerReportRow, ManpowerReportResponse
from app.utils.report_pdf import render_report_pdf, table_html
from .common import period_expr

router = APIRouter()

@router.get("/get_manpower_summary", response_model=ManpowerReportResponse)
def manpower_summary_report(
    from_date: date,
    to_date: date,
    group_by: str = "month",
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("reports.read"))
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


@router.get("/get_manpower_summary_pdf")
def manpower_summary_report_pdf(
    from_date: date,
    to_date: date,
    group_by: str = "month",
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("reports.read"))
):
    report = manpower_summary_report(
        from_date=from_date,
        to_date=to_date,
        group_by=group_by,
        db=db,
        _=_,
    )
    body_rows = [
        [
            row.period,
            row.regular_cooking,
            row.additional_cooking,
            row.total_cooking,
            row.regular_serving,
            row.additional_serving,
            row.total_serving,
            row.regular_cleaning,
            row.additional_cleaning,
            row.total_cleaning,
        ]
        for row in report.rows
    ]
    if report.rows:
        totals = [
            "Grand Total",
            sum(row.regular_cooking for row in report.rows),
            sum(row.additional_cooking for row in report.rows),
            sum(row.total_cooking for row in report.rows),
            sum(row.regular_serving for row in report.rows),
            sum(row.additional_serving for row in report.rows),
            sum(row.total_serving for row in report.rows),
            sum(row.regular_cleaning for row in report.rows),
            sum(row.additional_cleaning for row in report.rows),
            sum(row.total_cleaning for row in report.rows),
        ]
        body_rows.append(totals)

    body_html = table_html(
        ["Period", "Cook Reg", "Cook Addl", "Cook Total", "Serve Reg", "Serve Addl", "Serve Total", "Clean Reg", "Clean Addl", "Clean Total"],
        body_rows,
        ["left", "right", "right", "right", "right", "right", "right", "right", "right", "right"],
    )
    pdf_bytes = render_report_pdf(
        db=db,
        title="Monthly Manpower Report",
        subtitle=f"From {from_date.strftime('%d-%m-%Y')} To {to_date.strftime('%d-%m-%Y')}",
        body_html=body_html,
        orientation="landscape",
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=manpower_report.pdf"},
    )

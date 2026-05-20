from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import Item, MonthlyStockSummary, User
from app.utils.report_pdf import render_report_pdf, table_html, money, qty

router = APIRouter()


@router.get("/monthly-performance")
@router.get("/get_monthly_performance")
def monthly_performance_report(
    db: Session = Depends(get_db), 
    _: User = Depends(PermissionChecker("reports.read"))
):
    results = (
        db.query(MonthlyStockSummary, Item.item_name)
        .join(Item, Item.id == MonthlyStockSummary.item_id)
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


@router.get("/monthly-performance/pdf")
def monthly_performance_report_pdf(
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("reports.read"))
):
    rows = monthly_performance_report(db=db, _=_)
    body_html = table_html(
        ["Month", "Item", "Opening", "Purchased", "Consumed", "Wastage", "Adjustment", "Closing", "Stock Value"],
        [
            [
                row["month"],
                row["item_name"],
                qty(row["opening_stock"]),
                qty(row["total_purchased"]),
                qty(row["total_consumed"]),
                qty(row["total_wastage"]),
                qty(row["total_adjustment"]),
                qty(row["closing_stock"]),
                money(row["stock_value"]),
            ]
            for row in rows
        ],
        ["left", "left", "right", "right", "right", "right", "right", "right", "right"],
    )
    pdf_bytes = render_report_pdf(
        db=db,
        title="Monthly Performance Report",
        body_html=body_html,
        orientation="landscape",
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=monthly_performance_report.pdf"},
    )

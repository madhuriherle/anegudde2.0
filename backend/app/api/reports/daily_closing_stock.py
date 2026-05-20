from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import DailyStockSummary, Item, User
from app.utils.report_pdf import render_report_pdf, table_html, money, qty

router = APIRouter()


@router.get("/daily-closing-stock")
@router.get("/get_daily_closing_stock")
def get_daily_closing_stock(
    target_date: date = Query(...), 
    db: Session = Depends(get_db), 
    _: User = Depends(PermissionChecker("reports.read"))
):
    results = (
        db.query(DailyStockSummary, Item.item_name)
        .join(Item, Item.id == DailyStockSummary.item_id)
        .filter(
            DailyStockSummary.summary_date == target_date
        )
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


@router.get("/daily-closing-stock/pdf")
def get_daily_closing_stock_pdf(
    target_date: date = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("reports.read"))
):
    rows = get_daily_closing_stock(target_date=target_date, db=db, _=_)
    body_html = table_html(
        ["Item", "Opening", "Purchased", "Consumed", "Wastage", "Adjustment", "Closing", "Stock Value"],
        [
            [
                row["item_name"],
                qty(row["opening_stock"]),
                qty(row["purchased_qty"]),
                qty(row["consumed_qty"]),
                qty(row["wastage_qty"]),
                qty(row["adjustment_qty"]),
                qty(row["closing_stock"]),
                money(row["stock_value"]),
            ]
            for row in rows
        ],
        ["left", "right", "right", "right", "right", "right", "right", "right"],
    )
    pdf_bytes = render_report_pdf(
        db=db,
        title="Daily Closing Stock Report",
        subtitle=f"Report Date: {target_date.strftime('%d-%m-%Y')}",
        body_html=body_html,
        orientation="landscape",
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=daily_closing_stock_{target_date}.pdf"},
    )

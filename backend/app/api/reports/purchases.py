from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import PurchaseEntry, PurchaseItem, User
from app.schemas.report import ReportRow, PurchaseDetailRow, PurchaseDetailItem
from .common import period_expr

router = APIRouter()


@router.get("/get_purchases_report", response_model=list[ReportRow])
def purchases_report(
    from_date: date = Query(...), 
    to_date: date = Query(...), 
    group_by: str = Query("day"), 
    db: Session = Depends(get_db), 
    _: User = Depends(PermissionChecker("reports.purchases.read"))
):
    period = period_expr(group_by, PurchaseEntry.purchase_date)
    rows = (
        db.query(period.label("period"), func.coalesce(func.sum(PurchaseEntry.total_amount), 0).label("total_amount"), func.count(PurchaseEntry.id).label("total_count"))
        .filter(
            PurchaseEntry.is_deleted == False,
            PurchaseEntry.purchase_date >= from_date, 
            PurchaseEntry.purchase_date <= to_date
        )
        .group_by(period)
        .order_by(period)
        .all()
    )
    return [ReportRow(period=r.period, total_amount=r.total_amount, total_count=r.total_count) for r in rows]


@router.get("/get_purchase_details", response_model=list[PurchaseDetailRow])
def purchase_details(
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("reports.purchases.read"))
):
    entries = (
        db.query(PurchaseEntry)
        .options(
            joinedload(PurchaseEntry.vendor),
            joinedload(PurchaseEntry.items).joinedload(PurchaseItem.item)
        )
        .filter(
            PurchaseEntry.is_deleted == False,
            PurchaseEntry.purchase_date >= from_date,
            PurchaseEntry.purchase_date <= to_date
        )
        .order_by(PurchaseEntry.purchase_date.desc(), PurchaseEntry.id.desc())
        .all()
    )
    result = []
    for e in entries:
        items = [
            PurchaseDetailItem(
                item_name=pi.item.item_name if pi.item else "Unknown",
                quantity=pi.quantity,
                price=pi.price,
                line_total=pi.line_total,
            )
            for pi in (e.items or [])
        ]
        result.append(PurchaseDetailRow(
            purchase_date=e.purchase_date,
            vendor_name=e.vendor.vendor_name if e.vendor else "Unknown",
            bill_no=e.bill_no,
            total_amount=e.total_amount,
            invoice_amount=e.invoice_amount,
            items=items,
        ))
    return result

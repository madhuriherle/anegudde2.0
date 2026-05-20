from datetime import date
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import User, DonationEntry, DonationItem, Item, DonationType
from app.schemas.report import ReportRow
from app.schemas.donation import DonationEntryFullOut
from app.utils.report_pdf import render_report_pdf, table_html, qty
from .common import period_expr

router = APIRouter()

@router.get("/get_donations_report", response_model=list[ReportRow])
def donations_report(
    from_date: date = Query(...), 
    to_date: date = Query(...), 
    group_by: str = Query("day"), 
    db: Session = Depends(get_db), 
    _: User = Depends(PermissionChecker("reports.read"))
):
    """
    Summary report of donations grouped by period.
    """
    period = period_expr(group_by, DonationEntry.donation_date)
    # Since donations might not have a "total amount" field (they are in-kind), 
    # we use the count of donations as total_amount for this generic schema,
    # or sum up the quantities if we want, but ReportRow expects Decimal for total_amount.
    # Let's use the count of entries.
    rows = (
        db.query(
            period.label("period"), 
            func.count(DonationEntry.id).label("total_amount"), 
            func.count(DonationEntry.id).label("total_count")
        )
        .filter(
            DonationEntry.donation_date >= from_date, 
            DonationEntry.donation_date <= to_date,
            DonationEntry.status == 1
        )
        .group_by(period)
        .order_by(period)
        .all()
    )
    return [ReportRow(period=r.period, total_amount=r.total_amount, total_count=r.total_count) for r in rows]

@router.get("/get_detailed_donations_report", response_model=list[DonationEntryFullOut])
def detailed_donations_report(
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    devotee_name: str | None = Query(None),
    item_id: int | None = Query(None),
    q: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("reports.read"))
):
    """
    Detailed report of donations with specific filters.
    Supports smart date extraction from 'q'.
    """
    import re
    if q:
        # Smart Search: Extract YYYY-MM-DD patterns
        date_patterns = re.findall(r"\d{4}-\d{2}-\d{2}", q)
        if len(date_patterns) >= 2:
            from_date, to_date = date_patterns[0], date_patterns[1]
            q = re.sub(r"\d{4}-\d{2}-\d{2}", "", q).strip()
        elif len(date_patterns) == 1:
            from_date = to_date = date_patterns[0]
            q = re.sub(r"\d{4}-\d{2}-\d{2}", "", q).strip()

    query = db.query(DonationEntry).options(
        joinedload(DonationEntry.items).joinedload(DonationItem.item).joinedload(Item.unit),
        joinedload(DonationEntry.user)
    ).filter(DonationEntry.status == 1)

    if from_date:
        query = query.filter(DonationEntry.donation_date >= from_date)
    if to_date:
        query = query.filter(DonationEntry.donation_date <= to_date)

    if devotee_name:
        query = query.filter(DonationEntry.devotee_name.ilike(f"%{devotee_name}%"))
    
    if q:
        like = f"%{q}%"
        query = query.filter(
            (DonationEntry.devotee_name.ilike(like)) |
            (DonationEntry.phone_number.ilike(like)) |
            (DonationEntry.remarks.ilike(like))
        )

    if item_id:
        query = query.join(DonationItem).filter(DonationItem.item_id == item_id)

    return query.order_by(DonationEntry.donation_date.desc(), DonationEntry.id.desc()).all()


@router.get("/get_detailed_donations_report_pdf")
def detailed_donations_report_pdf(
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    devotee_name: str | None = Query(None),
    item_id: int | None = Query(None),
    q: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("reports.read"))
):
    rows = detailed_donations_report(
        from_date=from_date,
        to_date=to_date,
        devotee_name=devotee_name,
        item_id=item_id,
        q=q,
        db=db,
        _=_,
    )
    type_names = {
        int(t.id): t.type_name
        for t in db.query(DonationType).all()
    }

    body_rows = []
    for row in rows:
        donated_items = ", ".join(
            f"{item.item.item_name if item.item else '-'} - {qty(item.quantity)} {item.item.unit.unit_code if item.item and item.item.unit else ''}".strip()
            for item in row.items
        ) or "-"
        body_rows.append([
            row.donation_date.strftime("%d-%m-%Y"),
            row.receipt_display_number or "-",
            type_names.get(int(row.donation_type), "General Donation"),
            row.devotee_name or "-",
            row.phone_number or "-",
            donated_items,
            row.remarks or "-",
        ])

    subtitle_parts = []
    if from_date:
        subtitle_parts.append(f"From {from_date.strftime('%d-%m-%Y')}")
    if to_date:
        subtitle_parts.append(f"To {to_date.strftime('%d-%m-%Y')}")
    if q:
        subtitle_parts.append(f"Search: {q}")

    body_html = table_html(
        ["Date", "Receipt No", "Type", "Devotee", "Phone", "Donated Item & Quantity", "Remarks"],
        body_rows,
        ["left", "left", "left", "left", "left", "left", "left"],
    )
    pdf_bytes = render_report_pdf(
        db=db,
        title="Donation Report",
        subtitle=" | ".join(subtitle_parts) if subtitle_parts else None,
        body_html=body_html,
        orientation="landscape",
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=donation_report.pdf"},
    )

from datetime import date
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import User, DonationEntry, DonationItem, Item, DonationType
from app.schemas.report import ReportRow
from app.schemas.donation import DonationEntryFullOut
from .common import period_expr

router = APIRouter()

@router.get("/get_donations_report", response_model=list[ReportRow])
def donations_report(
    from_date: date = Query(...), 
    to_date: date = Query(...), 
    group_by: str = Query("day"), 
    db: Session = Depends(get_db), 
    _: User = Depends(PermissionChecker("reports.donations.read"))
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
            DonationEntry.is_deleted == False,
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
    _: User = Depends(PermissionChecker("reports.donations.read"))
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
    ).filter(
        DonationEntry.is_deleted == False,
        DonationEntry.status == 1,
        DonationEntry.donation_type == 2
    )

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

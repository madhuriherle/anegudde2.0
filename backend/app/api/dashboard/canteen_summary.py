from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import TokenGeneration, WastageEntry, WastageItem, User, DonationEntry, DonationItem, Item, DonationType
from pydantic import BaseModel

router = APIRouter()

class WastageItemDetail(BaseModel):
    item_name: str
    quantity: Decimal
    amount: Decimal
    unit_name: str

class DonationTypeSummary(BaseModel):
    type_name: str
    total_items: int
    total_value: Decimal

class CanteenSummaryStats(BaseModel):
    daily_tokens: int
    weekly_tokens: int
    monthly_tokens: int
    wastage_today: Decimal
    wastage_items: list[WastageItemDetail]
    donation_summary: list[DonationTypeSummary]

@router.get("/get_canteen_summary", response_model=CanteenSummaryStats)
def get_canteen_summary_stats(
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("dashboard.read"))
):
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    start_of_month = today.replace(day=1)

    # Daily Tokens
    daily_tokens = (
        db.query(func.coalesce(func.sum(TokenGeneration.total_tokens), 0))
        .filter(TokenGeneration.date == today)
        .scalar()
        or 0
    )

    # Weekly Tokens
    weekly_tokens = (
        db.query(func.coalesce(func.sum(TokenGeneration.total_tokens), 0))
        .filter(TokenGeneration.date >= start_of_week, TokenGeneration.date <= today)
        .scalar()
        or 0
    )

    # Monthly Tokens
    monthly_tokens = (
        db.query(func.coalesce(func.sum(TokenGeneration.total_tokens), 0))
        .filter(TokenGeneration.date >= start_of_month, TokenGeneration.date <= today)
        .scalar()
        or 0
    )

    # Wastage Today Total
    wastage_total = (
        db.query(func.coalesce(func.sum(WastageItem.quantity * WastageItem.approx_amount), 0))
        .join(WastageEntry, WastageEntry.id == WastageItem.wastage_entry_id)
        .filter(WastageEntry.is_deleted == False, WastageEntry.wastage_date == today, WastageEntry.status == 1)
        .scalar()
        or Decimal("0")
    )

    # Detailed Wastage Items
    from app.db.models import MenuItem, Unit
    wastage_items_raw = (
        db.query(
            MenuItem.dish_name,
            func.sum(WastageItem.quantity).label("quantity"),
            func.sum(WastageItem.quantity * WastageItem.approx_amount).label("amount"),
            Unit.unit_name
        )
        .join(WastageItem, WastageItem.menu_item_id == MenuItem.id)
        .join(WastageEntry, WastageEntry.id == WastageItem.wastage_entry_id)
        .join(Unit, MenuItem.unit_id == Unit.id)
        .filter(WastageEntry.is_deleted == False, WastageEntry.wastage_date == today, WastageEntry.status == 1)
        .group_by(MenuItem.dish_name, Unit.unit_name)
        .all()
    )

    wastage_items = [
        WastageItemDetail(
            item_name=r.dish_name,
            quantity=r.quantity,
            amount=r.amount,
            unit_name=r.unit_name
        ) for r in wastage_items_raw
    ]

    # Donation Summary (Kind Donations)
    donation_types = db.query(DonationType).filter(DonationType.status == 1).order_by(DonationType.type_name.asc()).all()
    donation_summary = []
    
    for donation_type in donation_types:
        # Count total items donated today for this type
        total_items = (
            db.query(func.count(DonationItem.id))
            .join(DonationEntry, DonationEntry.id == DonationItem.donation_entry_id)
            .filter(DonationEntry.is_deleted == False, DonationEntry.donation_date == today, DonationEntry.donation_type == donation_type.id, DonationEntry.status == 1)
            .scalar()
            or 0
        )
        
        # Calculate approximate value (qty * item.default_price)
        total_value = (
            db.query(func.coalesce(func.sum(DonationItem.quantity * Item.default_price), 0))
            .join(DonationEntry, DonationEntry.id == DonationItem.donation_entry_id)
            .join(Item, Item.id == DonationItem.item_id)
            .filter(DonationEntry.is_deleted == False, DonationEntry.donation_date == today, DonationEntry.donation_type == donation_type.id, DonationEntry.status == 1)
            .scalar()
            or Decimal("0")
        )
        
        donation_summary.append(DonationTypeSummary(
            type_name=donation_type.type_name,
            total_items=total_items,
            total_value=total_value
        ))

    return CanteenSummaryStats(
        daily_tokens=daily_tokens,
        weekly_tokens=weekly_tokens,
        monthly_tokens=monthly_tokens,
        wastage_today=wastage_total,
        wastage_items=wastage_items,
        donation_summary=donation_summary
    )


@router.get("/canteen_summary", response_model=CanteenSummaryStats)
def get_canteen_summary_stats_legacy(
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("dashboard.read"))
):
    return get_canteen_summary_stats(db, _)

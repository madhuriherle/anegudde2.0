from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import TokenGeneration, WastageEntry, WastageItem, User
from pydantic import BaseModel

router = APIRouter()

class WastageItemDetail(BaseModel):
    item_name: str
    quantity: Decimal
    amount: Decimal
    unit_name: str

class CanteenSummaryStats(BaseModel):
    daily_tokens: int
    weekly_tokens: int
    monthly_tokens: int
    wastage_today: Decimal
    wastage_items: list[WastageItemDetail]

@router.get("/canteen_summary", response_model=CanteenSummaryStats)
def get_canteen_summary_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
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
        db.query(func.coalesce(func.sum(WastageItem.approx_amount), 0))
        .join(WastageEntry, WastageEntry.id == WastageItem.wastage_entry_id)
        .filter(WastageEntry.wastage_date == today, WastageEntry.status == 1)
        .scalar()
        or Decimal("0")
    )

    # Detailed Wastage Items
    from app.db.models import MenuItem, Unit
    wastage_items_raw = (
        db.query(
            MenuItem.dish_name,
            func.sum(WastageItem.quantity).label("quantity"),
            func.sum(WastageItem.approx_amount).label("amount"),
            Unit.unit_name
        )
        .join(WastageItem, WastageItem.menu_item_id == MenuItem.id)
        .join(WastageEntry, WastageEntry.id == WastageItem.wastage_entry_id)
        .join(Unit, MenuItem.unit_id == Unit.id)
        .filter(WastageEntry.wastage_date == today, WastageEntry.status == 1)
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

    return CanteenSummaryStats(
        daily_tokens=daily_tokens,
        weekly_tokens=weekly_tokens,
        monthly_tokens=monthly_tokens,
        wastage_today=wastage_total,
        wastage_items=wastage_items
    )

from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, cast, Numeric
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_financial_year
from app.db.models import Item, ItemCategory, Unit, User, Vendor, FinancialYear
from app.schemas.dashboard import DashboardOverview

router = APIRouter()


@router.get("/overview", response_model=DashboardOverview)
def overview(
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user),
    financial_year: FinancialYear = Depends(get_financial_year)
):
    total_vendors = db.query(func.count(Vendor.id)).filter(Vendor.financial_year_id == financial_year.id).scalar() or 0
    total_items = db.query(func.count(Item.id)).filter(Item.financial_year_id == financial_year.id).scalar() or 0
    total_units = db.query(func.count(Unit.id)).filter(Unit.financial_year_id == financial_year.id).scalar() or 0
    total_categories = db.query(func.count(ItemCategory.id)).filter(ItemCategory.financial_year_id == financial_year.id).scalar() or 0
    total_users = db.query(func.count(User.id)).scalar() or 0

    low_stock_items = (
        db.query(func.count(Item.id))
        .filter(
            Item.financial_year_id == financial_year.id,
            Item.min_stock_level.isnot(None), 
            cast(Item.current_stock, Numeric) < Item.min_stock_level
        )
        .scalar()
        or 0
    )

    total_stock_value = (
        db.query(func.coalesce(func.sum(cast(Item.current_stock, Numeric) * func.coalesce(Item.default_price, 0)), 0))
        .filter(Item.financial_year_id == financial_year.id)
        .scalar()
        or Decimal("0")
    )

    total_outstanding_balance = Decimal("0")

    return DashboardOverview(
        total_vendors=total_vendors,
        total_items=total_items,
        total_units=total_units,
        total_categories=total_categories,
        total_users=total_users,
        low_stock_items=low_stock_items,
        total_stock_value=total_stock_value,
        total_outstanding_balance=total_outstanding_balance,
    )

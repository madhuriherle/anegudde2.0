from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_financial_year
from app.db.models import ConsumptionEntry, ConsumptionItem, PurchaseEntry, User, VendorPayment, WastageEntry, WastageItem, FinancialYear
from app.schemas.dashboard import DashboardToday

router = APIRouter()


@router.get("/today", response_model=DashboardToday)
def today_summary(
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user),
    financial_year: FinancialYear = Depends(get_financial_year)
):
    today = date.today()

    purchase_amount = (
        db.query(func.coalesce(func.sum(PurchaseEntry.total_amount), 0))
        .filter(PurchaseEntry.purchase_date == today, PurchaseEntry.financial_year_id == financial_year.id)
        .scalar()
        or Decimal("0")
    )
    
    consumption_entries = (
        db.query(func.count(ConsumptionEntry.id))
        .filter(ConsumptionEntry.usage_date == today, ConsumptionEntry.financial_year_id == financial_year.id)
        .scalar() 
        or 0
    )
    consumption_value = (
        db.query(func.coalesce(func.sum(ConsumptionItem.line_total), 0))
        .join(ConsumptionEntry)
        .filter(ConsumptionEntry.usage_date == today, ConsumptionEntry.financial_year_id == financial_year.id)
        .scalar()
        or Decimal("0")
    )
    
    wastage_entries = (
        db.query(func.count(WastageEntry.id))
        .filter(WastageEntry.wastage_date == today, WastageEntry.financial_year_id == financial_year.id)
        .scalar() 
        or 0
    )
    wastage_value = Decimal("0") # Cooked food wastage doesn't have a direct raw material cost tracked here
    
    vendor_payment_amount = (
        db.query(func.coalesce(func.sum(VendorPayment.amount), 0))
        .filter(VendorPayment.payment_date == today, VendorPayment.financial_year_id == financial_year.id)
        .scalar()
        or Decimal("0")
    )

    return DashboardToday(
        purchase_amount=purchase_amount,
        consumption_entries=consumption_entries,
        consumption_value=consumption_value,
        wastage_entries=wastage_entries,
        wastage_value=wastage_value,
        vendor_payment_amount=vendor_payment_amount,
    )

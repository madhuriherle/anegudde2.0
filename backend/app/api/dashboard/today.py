from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import ConsumptionEntry, ConsumptionItem, PurchaseEntry, User, VendorPayment, WastageEntry, WastageItem
from app.schemas.dashboard import DashboardToday

router = APIRouter()


@router.get("/today", response_model=DashboardToday)
def today_summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    today = date.today()

    purchase_amount = (
        db.query(func.coalesce(func.sum(PurchaseEntry.total_amount), 0)).filter(PurchaseEntry.purchase_date == today).scalar()
        or Decimal("0")
    )
    
    consumption_entries = db.query(func.count(ConsumptionEntry.id)).filter(ConsumptionEntry.usage_date == today).scalar() or 0
    consumption_value = (
        db.query(func.coalesce(func.sum(ConsumptionItem.line_total), 0))
        .join(ConsumptionEntry)
        .filter(ConsumptionEntry.usage_date == today)
        .scalar()
        or Decimal("0")
    )
    
    wastage_entries = db.query(func.count(WastageEntry.id)).filter(WastageEntry.wastage_date == today).scalar() or 0
    wastage_value = (
        db.query(func.coalesce(func.sum(WastageItem.line_total), 0))
        .join(WastageEntry)
        .filter(WastageEntry.wastage_date == today)
        .scalar()
        or Decimal("0")
    )
    
    vendor_payment_amount = (
        db.query(func.coalesce(func.sum(VendorPayment.amount), 0)).filter(VendorPayment.payment_date == today).scalar()
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

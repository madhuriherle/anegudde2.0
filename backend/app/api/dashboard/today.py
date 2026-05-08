from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import ConsumptionEntry, ConsumptionItem, PurchaseEntry, PurchaseItem, User, VendorPayment, WastageEntry, WastageItem, TokenGeneration, Item, MenuItem, Unit
from app.schemas.dashboard import DashboardToday, DailyItemDetail, DailyWastageDetail

router = APIRouter()


@router.get("/get_today_summary", response_model=DashboardToday)
def today_summary(
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user)
):
    today = date.today()

    purchase_amount = (
        db.query(func.coalesce(func.sum(PurchaseEntry.total_amount), 0))
        .filter(PurchaseEntry.purchase_date == today)
        .scalar()
        or Decimal("0")
    )
    
    consumption_entries = (
        db.query(func.count(ConsumptionEntry.id))
        .filter(ConsumptionEntry.usage_date == today)
        .scalar() 
        or 0
    )
    consumption_value = (
        db.query(func.coalesce(func.sum(ConsumptionItem.line_total), 0))
        .join(ConsumptionEntry)
        .filter(ConsumptionEntry.usage_date == today)
        .scalar()
        or Decimal("0")
    )
    
    wastage_entries = (
        db.query(func.count(WastageEntry.id))
        .filter(WastageEntry.wastage_date == today)
        .scalar() 
        or 0
    )
    wastage_value = Decimal("0") 
    
    vendor_payment_amount = (
        db.query(func.coalesce(func.sum(VendorPayment.amount), 0))
        .filter(VendorPayment.payment_date == today)
        .scalar()
        or Decimal("0")
    )

    tokens_issued = (
        db.query(func.coalesce(func.sum(TokenGeneration.total_tokens), 0))
        .filter(TokenGeneration.date == today)
        .scalar()
        or 0
    )

    # Detailed Breakdowns
    purchase_details_raw = (
        db.query(
            Item.item_name,
            Unit.unit_name,
            func.sum(PurchaseItem.quantity).label("quantity"),
            func.sum(PurchaseItem.line_total).label("amount")
        )
        .join(PurchaseItem, PurchaseItem.item_id == Item.id)
        .join(PurchaseEntry, PurchaseEntry.id == PurchaseItem.purchase_entry_id)
        .join(Unit, Item.unit_id == Unit.id)
        .filter(PurchaseEntry.purchase_date == today)
        .group_by(Item.item_name, Unit.unit_name)
        .all()
    )
    purchase_details = [
        DailyItemDetail(item_name=r.item_name, unit_name=r.unit_name, quantity=r.quantity, amount=r.amount)
        for r in purchase_details_raw
    ]

    consumption_details_raw = (
        db.query(
            Item.item_name,
            Unit.unit_name,
            func.sum(ConsumptionItem.net_quantity).label("quantity"),
            func.sum(ConsumptionItem.line_total).label("amount")
        )
        .join(ConsumptionItem, ConsumptionItem.item_id == Item.id)
        .join(ConsumptionEntry, ConsumptionEntry.id == ConsumptionItem.consumption_entry_id)
        .join(Unit, Item.unit_id == Unit.id)
        .filter(ConsumptionEntry.usage_date == today)
        .group_by(Item.item_name, Unit.unit_name)
        .all()
    )
    consumption_details = [
        DailyItemDetail(item_name=r.item_name, unit_name=r.unit_name, quantity=r.quantity, amount=r.amount)
        for r in consumption_details_raw
    ]

    wastage_details_raw = (
        db.query(
            MenuItem.dish_name,
            Unit.unit_name,
            func.sum(WastageItem.quantity).label("quantity")
        )
        .join(WastageItem, WastageItem.menu_item_id == MenuItem.id)
        .join(WastageEntry, WastageEntry.id == WastageItem.wastage_entry_id)
        .join(Unit, MenuItem.unit_id == Unit.id)
        .filter(WastageEntry.wastage_date == today)
        .group_by(MenuItem.dish_name, Unit.unit_name)
        .all()
    )
    wastage_details = [
        DailyWastageDetail(menu_item_name=r.dish_name, unit_name=r.unit_name, quantity=r.quantity)
        for r in wastage_details_raw
    ]

    return DashboardToday(
        purchase_amount=purchase_amount,
        consumption_entries=consumption_entries,
        consumption_value=consumption_value,
        wastage_entries=wastage_entries,
        wastage_value=wastage_value,
        vendor_payment_amount=vendor_payment_amount,
        tokens_issued=tokens_issued,
        purchase_details=purchase_details,
        consumption_details=consumption_details,
        wastage_details=wastage_details
    )

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import ConsumptionEntry, PurchaseEntry, User, Vendor, VendorPayment, WastageEntry
from app.schemas.dashboard import RecentActivityRow

router = APIRouter()


@router.get("/recent-activity", response_model=list[RecentActivityRow])
def recent_activity(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    activities: list[RecentActivityRow] = []

    purchases = db.query(PurchaseEntry, Vendor.vendor_name).join(Vendor).order_by(PurchaseEntry.created_at.desc()).limit(10).all()
    for p, v_name in purchases:
        activities.append(RecentActivityRow(activity_type="purchase", title=f"Purchase from {v_name}", description=f"Bill No: {p.bill_no or 'N/A'}", amount=p.total_amount, created_at=p.created_at))

    consumptions = db.query(ConsumptionEntry).order_by(ConsumptionEntry.created_at.desc()).limit(10).all()
    for c in consumptions:
        activities.append(RecentActivityRow(activity_type="consumption", title="Material Consumption", description=f"Served {c.people_served or 0} people", created_at=c.created_at))

    wastages = db.query(WastageEntry).order_by(WastageEntry.created_at.desc()).limit(10).all()
    for w in wastages:
        activities.append(RecentActivityRow(activity_type="wastage", title="Wastage Recorded", description=w.reason or "No reason provided", created_at=w.created_at))

    payments = db.query(VendorPayment, Vendor.vendor_name).join(Vendor).order_by(VendorPayment.created_at.desc()).limit(10).all()
    for pay, v_name in payments:
        activities.append(RecentActivityRow(activity_type="payment", title=f"Payment to {v_name}", description=f"Mode: {pay.payment_mode}", amount=pay.amount, created_at=pay.created_at))

    activities.sort(key=lambda x: x.created_at, reverse=True)
    return activities[:10]

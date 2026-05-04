from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User, Vendor

router = APIRouter()


@router.get("/vendor-outstanding")
def vendor_outstanding_report(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    vendors = db.query(Vendor).filter(Vendor.current_balance != 0).order_by(Vendor.current_balance.desc()).all()
    return [
        {
            "id": v.id,
            "vendor_code": v.vendor_code,
            "vendor_name": v.vendor_name,
            "contact_number": v.contact_number,
            "current_balance": v.current_balance,
            "credit_limit": v.credit_limit,
        }
        for v in vendors
    ]

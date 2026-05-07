from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_financial_year
from app.db.models import User, Vendor, FinancialYear

router = APIRouter()


@router.get("/vendor-outstanding")
def vendor_outstanding_report(
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user),
    financial_year: FinancialYear = Depends(get_financial_year)
):
    vendors = (
        db.query(Vendor)
        .filter(Vendor.financial_year_id == financial_year.id)
        .order_by(Vendor.id.desc())
        .all()
    )
    return [
        {
            "id": v.id,
            "vendor_code": v.vendor_code,
            "vendor_name": v.vendor_name,
            "contact_number": v.contact_number,
            "current_balance": v.opening_balance,
            "credit_limit": None,
        }
        for v in vendors
    ]

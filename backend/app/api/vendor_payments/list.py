from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import User, VendorPayment
from app.schemas.vendor_payment import VendorPaymentOut
router = APIRouter()
@router.get("/", response_model=list[VendorPaymentOut])
def list_vendor_payments(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(VendorPayment).order_by(VendorPayment.id.desc()).all()


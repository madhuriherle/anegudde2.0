from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import User, Vendor, VendorPayment
from app.schemas.vendor_payment import VendorPaymentCreate, VendorPaymentOut
router = APIRouter()
@router.post("/", response_model=VendorPaymentOut, status_code=status.HTTP_201_CREATED)
def create_vendor_payment(payload: VendorPaymentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not db.query(Vendor).filter(Vendor.id == payload.vendor_id).first(): raise HTTPException(status_code=400, detail="Invalid vendor_id")
    if not db.query(User).filter(User.id == payload.user_id).first(): raise HTTPException(status_code=400, detail="Invalid user_id")
    now = datetime.now(timezone.utc)
    next_payment_id = (db.query(func.max(VendorPayment.id)).scalar() or 0) + 1
    row = VendorPayment(id=next_payment_id, **payload.model_dump(), created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id)
    db.add(row); db.commit()
    return VendorPaymentOut(
        id=next_payment_id,
        vendor_id=payload.vendor_id,
        payment_date=payload.payment_date,
        amount=payload.amount,
        payment_mode=payload.payment_mode,
        reference_no=payload.reference_no,
        remarks=payload.remarks,
        user_id=payload.user_id,
        status=payload.status,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id,
    )


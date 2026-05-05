from datetime import datetime, timezone
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.db.models import User, Vendor, VendorPayment

def list_vendor_payments(db: Session, page: int = 1, page_size: int = 20, vendor_id: int = None):
    query = db.query(VendorPayment)
    if vendor_id:
        query = query.filter(VendorPayment.vendor_id == vendor_id)
    return query.order_by(VendorPayment.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

def create_vendor_payment(payload, db: Session, current_user: User) -> VendorPayment:
    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=400, detail="Invalid vendor_id")

    now = datetime.now(timezone.utc)
    
    payment = VendorPayment(
        vendor_id=payload.vendor_id,
        payment_date=payload.payment_date,
        amount=payload.amount,
        payment_mode=payload.payment_mode,
        reference_no=payload.reference_no,
        remarks=payload.remarks,
        user_id=current_user.id,
        status=1,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id
    )
    
    db.add(payment)
    
    # Update Vendor Balance: Payment decreases the outstanding balance
    vendor.current_balance -= Decimal(str(payload.amount))
    
    db.commit()
    db.refresh(payment)
    return payment

def delete_vendor_payment(payment_id: int, db: Session, current_user: User) -> None:
    payment = db.query(VendorPayment).filter(VendorPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    vendor = db.query(Vendor).filter(Vendor.id == payment.vendor_id).first()
    if vendor:
        # Reverse the balance update: Deleting a payment increases the outstanding balance
        vendor.current_balance += Decimal(str(payment.amount))
    
    db.delete(payment)
    db.commit()

def get_vendor_payment(payment_id: int, db: Session) -> VendorPayment:
    payment = db.query(VendorPayment).filter(VendorPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

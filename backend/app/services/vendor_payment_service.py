from datetime import datetime, timezone
import math
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.models import User, Vendor, VendorPayment, PurchaseEntry

def list_vendor_payments(db: Session, page: int = 1, page_size: int = 20, q: str = None, status: int | None = 1):
    import re
    query = db.query(VendorPayment).join(Vendor, VendorPayment.vendor_id == Vendor.id)
    if status is not None:
        query = query.filter(VendorPayment.status == status)
    
    # Smart Search: Extract dates from q if present
    from_date, to_date = None, None
    if q:
        date_patterns = re.findall(r"\d{4}-\d{2}-\d{2}", q)
        if len(date_patterns) >= 2:
            from_date, to_date = date_patterns[0], date_patterns[1]
            q = re.sub(r"\d{4}-\d{2}-\d{2}", "", q).strip()
        elif len(date_patterns) == 1:
            from_date = to_date = date_patterns[0]
            q = re.sub(r"\d{4}-\d{2}-\d{2}", "", q).strip()

    if from_date:
        query = query.filter(VendorPayment.payment_date >= from_date)
    if to_date:
        query = query.filter(VendorPayment.payment_date <= to_date)

    if q:
        like = f"%{q}%"
        query = query.filter(
            (Vendor.vendor_name.ilike(like)) |
            (VendorPayment.reference_no.ilike(like)) |
            (VendorPayment.remarks.ilike(like))
        )
    
    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(VendorPayment.id.desc()).offset(offset).limit(page_size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }

def create_vendor_payment(payload, db: Session, current_user: User) -> VendorPayment:
    now = datetime.now(timezone.utc)
    today = now.date()
    
    # --- SAFETY BLOCK: Prevent Future Dates ---
    if payload.payment_date > today:
        raise HTTPException(status_code=400, detail="Payment date cannot be in the future.")

    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=400, detail="Invalid vendor_id")

    # --- SMART BLOCK: Prevent Overpayment ---
    total_purchases = db.query(func.sum(func.coalesce(PurchaseEntry.invoice_amount, PurchaseEntry.total_amount))).filter(
        PurchaseEntry.vendor_id == payload.vendor_id, 
        PurchaseEntry.status == 1
    ).scalar() or Decimal("0")
    
    total_payments = db.query(func.sum(VendorPayment.amount)).filter(
        VendorPayment.vendor_id == payload.vendor_id, 
        VendorPayment.status == 1
    ).scalar() or Decimal("0")
    
    outstanding = Decimal(str(vendor.opening_balance)) + Decimal(str(total_purchases)) - Decimal(str(total_payments))
    
    if Decimal(str(payload.amount)) > outstanding:
        raise HTTPException(
            status_code=422, 
            detail=f"Payment exceeds outstanding balance. Total outstanding for '{vendor.vendor_name}' is ₹{outstanding:.2f}."
        )
    # ---------------------------------------

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
    db.commit()
    db.refresh(payment)
    return payment

def delete_vendor_payment(payment_id: int, db: Session, current_user: User) -> None:
    payment = db.query(VendorPayment).filter(VendorPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Soft delete
    payment.status = 0
    payment.updated_at = datetime.now(timezone.utc)
    payment.updated_by = current_user.id
    db.commit()

def get_vendor_payment(payment_id: int, db: Session) -> VendorPayment:
    payment = db.query(VendorPayment).filter(VendorPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

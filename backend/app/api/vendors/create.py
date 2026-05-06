from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User, Vendor
from app.schemas.vendor import VendorCreate, VendorOut

router = APIRouter()


@router.post("/create_vendor", response_model=VendorOut, status_code=status.HTTP_201_CREATED)
def create_vendor(payload: VendorCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    data = payload.model_dump()
    
    # Auto-generate vendor_code if not provided
    if not data.get("vendor_code"):
        # Find the highest existing VEN-XXX code
        from sqlalchemy import func
        last_vendor = db.query(Vendor).filter(Vendor.vendor_code.like("VEN-%")).order_by(Vendor.id.desc()).first()
        
        next_num = 1
        if last_vendor:
            try:
                # Extract number from VEN-XXX
                last_num = int(last_vendor.vendor_code.split("-")[1])
                next_num = last_num + 1
            except (ValueError, IndexError):
                # Fallback if code format is weird, use count
                next_num = db.query(Vendor).count() + 1
        
        data["vendor_code"] = f"VEN-{next_num:03d}"

    # Final check for uniqueness
    exists = db.query(Vendor).filter(Vendor.vendor_code == data["vendor_code"]).first()
    if exists:
        # If VEN-XXX already exists (rare race condition), append a random suffix or use ID
        import time
        data["vendor_code"] += f"-{int(time.time()) % 1000}"

    now = datetime.now(timezone.utc)
    vendor = Vendor(**data, created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id)
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor


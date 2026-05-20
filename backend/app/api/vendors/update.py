from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, PermissionChecker
from app.db.models import User, Vendor
from app.schemas.vendor import VendorOut, VendorUpdate

router = APIRouter()


@router.put("/update_vendor/{vendor_id}", response_model=VendorOut)
def update_vendor(vendor_id: int, payload: VendorUpdate, db: Session = Depends(get_db), current_user: User = Depends(PermissionChecker("vendors.write"))):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    try:
        data = payload.model_dump(exclude_unset=True)
        
        # If vendor_code is being updated, check for uniqueness
        if "vendor_code" in data and data["vendor_code"] != vendor.vendor_code:
            exists = db.query(Vendor).filter(Vendor.vendor_code == data["vendor_code"]).first()
            if exists:
                raise HTTPException(status_code=400, detail=f"Vendor code '{data['vendor_code']}' is already in use")

        for key, value in data.items():
            setattr(vendor, key, value)
            
        vendor.updated_at = datetime.now(timezone.utc)
        vendor.updated_by = current_user.id
        db.commit()
        db.refresh(vendor)
        return vendor
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

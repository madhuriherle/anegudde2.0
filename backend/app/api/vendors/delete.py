from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import User, Vendor, PurchaseEntry

router = APIRouter()


@router.delete("/delete_vendor/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor(
    vendor_id: int, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: User = Depends(PermissionChecker("vendors.delete"))
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Attach snapshot metadata for audit logging
    request.state.audit_meta = {
        "vendor_name": vendor.vendor_name,
        "vendor_code": vendor.vendor_code,
        "snapshot": {
            "id": vendor.id,
            "vendor_name": vendor.vendor_name,
            "vendor_code": vendor.vendor_code,
        }
    }
    
    from datetime import datetime, timezone
    vendor.is_deleted = True
    vendor.deleted_at = datetime.now(timezone.utc)
    vendor.deleted_by_id = current_user.id
    db.commit()
    return None

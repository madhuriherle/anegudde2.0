from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, PermissionChecker
from app.db.models import User, Vendor
from app.schemas.vendor import VendorOut

router = APIRouter()


@router.get("/get_vendor/{vendor_id}", response_model=VendorOut)
def get_vendor(vendor_id: int, db: Session = Depends(get_db), _: User = Depends(PermissionChecker("vendors.read"))):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor

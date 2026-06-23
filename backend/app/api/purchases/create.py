from fastapi import APIRouter, Depends, status, Request
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import User
from app.schemas.purchase import PurchaseEntryCreate, PurchaseEntryOut
from app.services.purchase_service import create_purchase as create_purchase_service

router = APIRouter()

@router.post("/create_purchase", response_model=PurchaseEntryOut, status_code=status.HTTP_201_CREATED)
def create_purchase(
    payload: PurchaseEntryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("purchases.write"))
):
    entry = create_purchase_service(payload, db, current_user)
    
    # Attach snapshot metadata for audit logging
    request.state.audit_meta = {
        "vendor_name": entry.vendor.vendor_name if entry.vendor else None,
        "bill_no": entry.bill_no,
        "snapshot": {
            "id": entry.id,
            "bill_no": entry.bill_no,
            "vendor_name": entry.vendor.vendor_name if entry.vendor else None,
            "purchase_date": entry.purchase_date.isoformat() if entry.purchase_date else None,
            "total_amount": str(entry.total_amount) if entry.total_amount else None,
        }
    }
    
    return entry


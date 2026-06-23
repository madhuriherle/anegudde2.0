from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.db.models import User
from app.schemas.purchase import PurchaseEntryFullOut, PurchaseEntryUpdate
from app.services.purchase_service import update_purchase

router = APIRouter()

@router.put("/update_purchase/{purchase_id}", response_model=PurchaseEntryFullOut)
def modify_purchase(
    purchase_id: int,
    payload: PurchaseEntryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("purchases.write"))
):
    entry = update_purchase(purchase_id, payload, db, current_user)
    
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

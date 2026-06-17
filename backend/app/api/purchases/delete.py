from fastapi import APIRouter, Depends, status, Request
from sqlalchemy.orm import Session, joinedload
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.db.models import User, PurchaseEntry
from app.services.purchase_service import delete_purchase

router = APIRouter()

@router.delete("/delete_purchase/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_purchase(
    purchase_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("purchases.delete"))
):
    # Fetch details before deletion for snapshot
    entry = db.query(PurchaseEntry).options(joinedload(PurchaseEntry.vendor)).filter(PurchaseEntry.id == purchase_id).first()
    if entry:
        request.state.audit_meta = {
            "vendor_name": entry.vendor.vendor_name if entry.vendor else None,
            "bill_no": entry.bill_no
        }
    
    delete_purchase(purchase_id, db, current_user)
    return None

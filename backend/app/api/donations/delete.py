from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, PermissionChecker
from app.db.models import User, DonationEntry
from app.services import donation_service

router = APIRouter()

@router.delete("/delete_donation/{donation_id}")
def delete_donation(
    donation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donations.delete"))
):
    # Fetch details before deletion for snapshot
    entry = db.query(DonationEntry).filter(DonationEntry.id == donation_id).first()
    if entry:
        request.state.audit_meta = {
            "devotee_name": entry.devotee_name,
            "receipt_display_number": entry.receipt_display_number
        }
    
    donation_service.delete_donation(donation_id, db, current_user)
    return {"status": "success"}

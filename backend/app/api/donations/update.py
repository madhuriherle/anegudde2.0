from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, PermissionChecker
from app.db.models import User
from app.services import donation_service
from app.schemas.donation import DonationEntryCreate, DonationEntryFullOut

router = APIRouter()

@router.put("/update_donation/{donation_id}", response_model=DonationEntryFullOut)
def update_donation(
    donation_id: int,
    payload: DonationEntryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donations.write"))
):
    entry = donation_service.update_donation(donation_id, payload, db, current_user)
    
    # Attach snapshot metadata for audit logging
    request.state.audit_meta = {
        "devotee_name": entry.devotee_name,
        "receipt_display_number": entry.receipt_display_number,
        "snapshot": {
            "id": entry.id,
            "devotee_name": entry.devotee_name,
            "receipt_display_number": entry.receipt_display_number,
            "donation_type_id": entry.donation_type_id,
            "total_amount": str(entry.total_amount) if entry.total_amount else None,
        }
    }
    
    return entry

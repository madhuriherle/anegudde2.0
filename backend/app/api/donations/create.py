from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, PermissionChecker
from app.db.models import User
from app.services import donation_service
from app.schemas.donation import DonationEntryCreate, DonationEntryFullOut

router = APIRouter()

@router.post("/create_donation", response_model=DonationEntryFullOut)
def create_donation(
    payload: DonationEntryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donations.write"))
):
    entry = donation_service.create_donation(payload, db, current_user)
    
    # Attach snapshot metadata for audit logging
    request.state.audit_meta = {
        "devotee_name": entry.devotee_name,
        "receipt_display_number": entry.receipt_display_number,
        "snapshot": {
            "id": entry.id,
            "devotee_name": entry.devotee_name,
            "receipt_display_number": entry.receipt_display_number,
            "donation_type": entry.donation_type,
            "total_gross_amount": str(entry.total_gross_amount) if entry.total_gross_amount else None,
        }
    }
    
    return entry

from fastapi import APIRouter, Depends
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
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donations.write"))
):
    return donation_service.update_donation(donation_id, payload, db, current_user)

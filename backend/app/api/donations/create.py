from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, PermissionChecker
from app.db.models import User
from app.services import donation_service
from app.schemas.donation import DonationEntryCreate, DonationEntryFullOut

router = APIRouter()

@router.post("/create_donation", response_model=DonationEntryFullOut)
def create_donation(
    payload: DonationEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donations.write"))
):
    return donation_service.create_donation(payload, db, current_user)

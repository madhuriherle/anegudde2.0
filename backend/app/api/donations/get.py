from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, PermissionChecker
from app.db.models import User
from app.services import donation_service
from app.schemas.donation import DonationEntryFullOut

router = APIRouter()

@router.get("/get_donation/{donation_id}", response_model=DonationEntryFullOut)
def get_donation(
    donation_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("donations.read"))
):
    return donation_service.get_donation(donation_id, db)

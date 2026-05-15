from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import deps
from app.services import donation_service
from app.schemas.donation import DonationEntryFullOut

router = APIRouter()

@router.get("/get_donation/{donation_id}", response_model=DonationEntryFullOut)
def get_donation(
    donation_id: int,
    db: Session = Depends(deps.get_db)
):
    return donation_service.get_donation(donation_id, db)

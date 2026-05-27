from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db, PermissionChecker
from app.db.models import User
from app.services import donation_service
from app.schemas.donation import DonationEntryFullOut
from app.schemas.base import PaginatedResponse

router = APIRouter()

@router.get("/list_donations", response_model=PaginatedResponse[DonationEntryFullOut])
def list_donations(
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("donations.read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str = Query(None),
    donation_type_id: int = Query(None)
):
    return donation_service.list_donations(db, page, page_size, q, donation_type_id)

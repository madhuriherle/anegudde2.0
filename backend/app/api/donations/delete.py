from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, PermissionChecker
from app.db.models import User
from app.services import donation_service

router = APIRouter()

@router.delete("/delete_donation/{donation_id}")
def delete_donation(
    donation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donations.delete"))
):
    donation_service.delete_donation(donation_id, db, current_user)
    return {"status": "success"}

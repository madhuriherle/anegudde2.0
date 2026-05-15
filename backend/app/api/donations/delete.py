from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import deps
from app.db.models import User
from app.services import donation_service

router = APIRouter()

@router.delete("/delete_donation/{donation_id}")
def delete_donation(
    donation_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    donation_service.delete_donation(donation_id, db, current_user)
    return {"status": "success"}

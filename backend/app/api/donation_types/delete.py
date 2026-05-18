from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import DonationEntry, DonationType, User

router = APIRouter()


@router.delete("/delete_donation_type/{donation_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_donation_type(
    donation_type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(DonationType).filter(DonationType.id == donation_type_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Donation type not found")

    has_donations = db.query(DonationEntry.id).filter(DonationEntry.donation_type == donation_type_id).first()
    if has_donations:
        row.status = 0
        row.updated_at = datetime.now(timezone.utc)
        row.updated_by = current_user.id
        db.commit()
        return None

    db.delete(row)
    db.commit()
    return None

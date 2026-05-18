from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import DonationType, User
from app.schemas.donation_type import DonationTypeOut, DonationTypeUpdate

router = APIRouter()


@router.put("/update_donation_type/{donation_type_id}", response_model=DonationTypeOut)
def update_donation_type(
    donation_type_id: int,
    payload: DonationTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(DonationType).filter(DonationType.id == donation_type_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Donation type not found")

    data = payload.model_dump(exclude_unset=True)
    if "type_name" in data and data["type_name"] is not None:
        type_name = data["type_name"].strip()
        exists = db.query(DonationType).filter(
            DonationType.id != donation_type_id,
            DonationType.type_name.ilike(type_name),
        ).first()
        if exists:
            raise HTTPException(status_code=400, detail="Donation type already exists")
        row.type_name = type_name
    if "receipt_prefix" in data and data["receipt_prefix"] is not None:
        row.receipt_prefix = data["receipt_prefix"].strip().upper()
    if "status" in data and data["status"] is not None:
        row.status = data["status"]

    row.updated_at = datetime.now(timezone.utc)
    row.updated_by = current_user.id
    db.commit()
    db.refresh(row)
    return row

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import DonationType, User
from app.schemas.donation_type import DonationTypeCreate, DonationTypeOut

router = APIRouter()


@router.post("/create_donation_type", response_model=DonationTypeOut, status_code=status.HTTP_201_CREATED)
def create_donation_type(
    payload: DonationTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    type_name = payload.type_name.strip()
    receipt_prefix = payload.receipt_prefix.strip().upper()
    exists = db.query(DonationType).filter(DonationType.type_name.ilike(type_name)).first()
    if exists:
        raise HTTPException(status_code=400, detail="Donation type already exists")

    now = datetime.now(timezone.utc)
    row = DonationType(
        type_name=type_name,
        receipt_prefix=receipt_prefix,
        status=payload.status,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, PermissionChecker
from app.db.models import DonationType, User, Module
from app.schemas.donation_type import DonationTypeOut, DonationTypeUpdate

router = APIRouter()

def normalize_receipt_prefix(value: str | None) -> str | None:
    prefix = (value or "").strip().upper()
    if prefix and prefix[-1].isalnum():
        return f"{prefix}-"
    return prefix or None

@router.get("/{donation_type_id}", response_model=DonationTypeOut)
def get_donation_type(
    donation_type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donation_types.read")),
):
    row = db.query(DonationType).filter(DonationType.id == donation_type_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Donation type not found")
    return row

@router.put("/update_donation_type/{donation_type_id}", response_model=DonationTypeOut)
def update_donation_type(
    donation_type_id: int,
    payload: DonationTypeUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donation_types.write")),
):
    row = db.query(DonationType).filter(DonationType.id == donation_type_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Donation type not found")

    request.state.audit_meta = {
        "type_name": row.type_name,
        "snapshot": {"id": row.id, "type_name": row.type_name, "receipt_prefix": row.receipt_prefix}
    }

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
    
    if "receipt_prefix" in data:
        row.receipt_prefix = normalize_receipt_prefix(data["receipt_prefix"])
    
    if "is_item_donation" in data and data["is_item_donation"] is not None:
        row.is_item_donation = data["is_item_donation"]

    if "status" in data and data["status"] is not None:
        row.status = data["status"]

    if "module_ids" in data:
        if data["module_ids"] is not None:
            modules = db.query(Module).filter(Module.id.in_(data["module_ids"])).all()
            row.modules = modules
        else:
            row.modules = []

    row.updated_at = datetime.now(timezone.utc)
    row.updated_by = current_user.id
    db.commit()
    db.refresh(row)
    return row

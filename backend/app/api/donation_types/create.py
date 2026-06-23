from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import DonationType, User, Module
from app.schemas.donation_type import DonationTypeCreate, DonationTypeOut

router = APIRouter()

def normalize_receipt_prefix(value: str | None) -> str | None:
    prefix = (value or "").strip().upper()
    if prefix and prefix[-1].isalnum():
        return f"{prefix}-"
    return prefix or None

@router.post("/create_donation_type", response_model=DonationTypeOut, status_code=status.HTTP_201_CREATED)
def create_donation_type(
    payload: DonationTypeCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donation_types.write")),
):
    type_name = payload.type_name.strip()
    receipt_prefix = normalize_receipt_prefix(payload.receipt_prefix)
    exists = db.query(DonationType).filter(DonationType.type_name.ilike(type_name)).first()
    if exists:
        raise HTTPException(status_code=400, detail="Donation type already exists")

    now = datetime.now(timezone.utc)
    row = DonationType(
        type_name=type_name,
        receipt_prefix=receipt_prefix,
        is_item_donation=payload.is_item_donation,
        status=payload.status,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    
    if payload.module_ids:
        modules = db.query(Module).filter(Module.id.in_(payload.module_ids)).all()
        row.modules = modules

    db.add(row)
    db.commit()
    db.refresh(row)
    
    # Attach snapshot metadata for audit logging
    request.state.audit_meta = {
        "type_name": row.type_name,
        "snapshot": {"id": row.id, "type_name": row.type_name, "receipt_prefix": row.receipt_prefix, "is_item_donation": row.is_item_donation}
    }
    
    return row

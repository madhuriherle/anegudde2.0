from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import exc
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import exc
from sqlalchemy.orm import Session
from app.api.deps import get_db, PermissionChecker
from app.db.models import DonationEntry, DonationType, User

router = APIRouter()


@router.delete("/delete_donation_type/{donation_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_donation_type(
    donation_type_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("donation_types.delete")),
):
    row = db.query(DonationType).filter(DonationType.id == donation_type_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Donation type not found")

    request.state.audit_meta = {"donation_type_name": row.type_name}

    row.is_deleted = True
    row.deleted_at = datetime.now(timezone.utc)
    row.deleted_by_id = current_user.id
    db.commit()

    return None

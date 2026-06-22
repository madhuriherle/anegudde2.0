from fastapi import APIRouter, Depends, status, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.db.models import User, WastageEntry
from app.services.wastage_service import delete_wastage

router = APIRouter()

@router.delete("/delete_wastage/{wastage_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_wastage(
    wastage_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("daily_usage.delete"))
):
    entry = db.query(WastageEntry).filter(WastageEntry.id == wastage_id).first()
    if entry:
        request.state.audit_meta = {
            "wastage_date": entry.wastage_date.isoformat() if entry.wastage_date else None
        }
    delete_wastage(wastage_id, db, current_user)
    return None

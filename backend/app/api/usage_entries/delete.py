from fastapi import APIRouter, Depends, status, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.db.models import User, ConsumptionEntry
from app.services.consumption_service import delete_consumption

router = APIRouter()

@router.delete("/delete_consumption/{consumption_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_consumption(
    consumption_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("consumptions.delete"))
):
    # Fetch details before deletion for snapshot
    entry = db.query(ConsumptionEntry).filter(ConsumptionEntry.id == consumption_id).first()
    if entry:
        request.state.audit_meta = {
            "usage_date": entry.usage_date.isoformat() if entry.usage_date else None
        }

    delete_consumption(consumption_id, db, current_user)
    return None

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.db.models import User
from app.schemas.consumption import ConsumptionEntryFullOut, ConsumptionEntryUpdate
from app.services.consumption_service import update_consumption

router = APIRouter()

@router.put("/update_consumption/{consumption_id}", response_model=ConsumptionEntryFullOut)
def update_consumption_entry(
    consumption_id: int,
    payload: ConsumptionEntryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("daily_usage.write"))
):
    entry = update_consumption(consumption_id, payload, db, current_user)
    
    # Attach snapshot metadata for audit logging
    request.state.audit_meta = {
        "usage_date": entry.usage_date.isoformat() if entry.usage_date else None,
        "snapshot": {"id": entry.id, "usage_date": entry.usage_date.isoformat() if entry.usage_date else None}
    }
    
    return entry

from fastapi import APIRouter, Depends, status, Request
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import User
from app.schemas.consumption import ConsumptionEntryCreate, ConsumptionEntryOut
from app.services.consumption_service import create_consumption as create_consumption_service

router = APIRouter()

@router.post("/create_consumption", response_model=ConsumptionEntryOut, status_code=status.HTTP_201_CREATED)
def create_consumption(
    payload: ConsumptionEntryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("daily_usage.write"))
):
    entry = create_consumption_service(payload, db, current_user)
    
    # Attach snapshot metadata for audit logging
    request.state.audit_meta = {
        "usage_date": entry.usage_date.isoformat() if entry.usage_date else None
    }
    
    return entry

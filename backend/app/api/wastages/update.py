from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.db.models import User
from app.schemas.wastage import WastageEntryFullOut, WastageEntryUpdate
from app.services.wastage_service import update_wastage

router = APIRouter()

@router.put("/update_wastage/{wastage_id}", response_model=WastageEntryFullOut)
def modify_wastage(
    wastage_id: int, 
    payload: WastageEntryUpdate, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: User = Depends(PermissionChecker("daily_usage.write"))
):
    entry = update_wastage(wastage_id, payload, db, current_user)
    
    # Attach snapshot metadata for audit logging
    request.state.audit_meta = {
        "wastage_date": entry.wastage_date.isoformat() if entry.wastage_date else None
    }
    
    return entry

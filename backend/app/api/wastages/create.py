from fastapi import APIRouter, Depends, status, Request
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import User
from app.schemas.wastage import WastageEntryCreate, WastageEntryOut
from app.services.wastage_service import create_wastage as create_wastage_service

router = APIRouter()

@router.post("/create_wastage", response_model=WastageEntryOut, status_code=status.HTTP_201_CREATED)
def create_wastage(
    payload: WastageEntryCreate, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: User = Depends(PermissionChecker("daily_usage.write"))
):
    # Ensure user_id in payload is the current user or handled by service
    # If the schema requires user_id, we can set it here if missing or just trust the payload
    if not payload.user_id:
        payload.user_id = current_user.id
        
    entry = create_wastage_service(payload, db, current_user)
    
    # Attach snapshot metadata for audit logging
    request.state.audit_meta = {
        "wastage_date": entry.wastage_date.isoformat() if entry.wastage_date else None,
        "snapshot": {"id": entry.id, "wastage_date": entry.wastage_date.isoformat() if entry.wastage_date else None}
    }
    
    return entry

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.schemas.token import TokenDetailCreate, TokenDetailResponse
from app.db.models import User
from app.services import token_service
from . import router

@router.post("/create_token", response_model=TokenDetailResponse)
def create_tokens(
    payload: TokenDetailCreate, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: User = Depends(PermissionChecker("tokens.write"))
):
    entry = token_service.create_tokens(payload, db, current_user)
    
    # Attach snapshot metadata for audit logging
    request.state.audit_meta = {
        "receipt_display_number": entry.receipt_display_number,
        "token_count": entry.token_count,
        "snapshot": {"id": entry.id, "receipt_display_number": entry.receipt_display_number, "token_count": entry.token_count}
    }
    
    return entry

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.schemas.wastage import WastageEntryCreate, WastageEntryOut
from app.services.wastage_service import create_wastage as create_wastage_service

router = APIRouter()

@router.post("/create_wastage", response_model=WastageEntryOut, status_code=status.HTTP_201_CREATED)
def create_wastage(
    payload: WastageEntryCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Ensure user_id in payload is the current user or handled by service
    # If the schema requires user_id, we can set it here if missing or just trust the payload
    if not payload.user_id:
        payload.user_id = current_user.id
        
    return create_wastage_service(payload, db, current_user)

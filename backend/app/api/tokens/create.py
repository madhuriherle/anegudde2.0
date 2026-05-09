from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.schemas.token import TokenDetailCreate, TokenDetailResponse
from app.db.models import User
from app.services import token_service
from . import router

@router.post("/create_token", response_model=TokenDetailResponse)
def create_tokens(
    payload: TokenDetailCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Create a new token entry. 
    If 'date' is provided in payload, it will be recorded for that date.
    Otherwise, it defaults to today.
    """
    return token_service.create_tokens(payload, db, current_user)

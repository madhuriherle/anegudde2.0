from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.schemas.token import TokenDetailCreate, TokenGenerationResponse
from app.db.models import User
from app.services import token_service
from . import router

@router.post("/", response_model=TokenGenerationResponse)
def create_tokens(payload: TokenDetailCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return token_service.create_tokens(payload, db, current_user)

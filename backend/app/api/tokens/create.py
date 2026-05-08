from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_financial_year
from app.schemas.token import TokenDetailCreate, TokenDetailResponse
from app.db.models import User, FinancialYear
from app.services import token_service
from . import router

@router.post("/create_token", response_model=TokenDetailResponse)
def create_tokens(
    payload: TokenDetailCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user),
    financial_year: FinancialYear = Depends(get_financial_year)
):
    return token_service.create_tokens(payload, db, current_user, financial_year)

@router.get("/generate_tokens", response_model=TokenDetailResponse)
def create_tokens_get(
    count: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user),
    financial_year: FinancialYear = Depends(get_financial_year)
):
    payload = TokenDetailCreate(token_count=count)
    return token_service.create_tokens(payload, db, current_user, financial_year)

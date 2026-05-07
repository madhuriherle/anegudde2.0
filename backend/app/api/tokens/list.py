from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date
from app.api.deps import get_db, get_current_user, get_financial_year
from app.schemas.token import TokenGenerationResponse, TokenDetailResponse
from app.db.models import User, FinancialYear
from app.services import token_service
from . import router

@router.get("/list_generations", response_model=list[TokenGenerationResponse])
def list_generations(
    page: int = 1, 
    page_size: int = 20, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user),
    financial_year: FinancialYear = Depends(get_financial_year)
):
    return token_service.list_token_generations(db, financial_year, page, page_size)

@router.get("/get_details_by_date/{target_date}", response_model=list[TokenDetailResponse])
def get_details(target_date: date, page: int = 1, page_size: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return token_service.get_token_details_by_date(target_date, db, page, page_size)

@router.get("/view_history_ledger", response_model=list[TokenDetailResponse])
def list_history(
    start_date: date = Query(None), 
    end_date: date = Query(None), 
    page: int = 1, 
    page_size: int = 50, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    return token_service.list_all_token_details(db, page, page_size, start_date, end_date)



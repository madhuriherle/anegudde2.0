from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.schemas.token import TokenGenerationResponse, TokenDetailResponse, TokenDetailPaginatedResponse
from app.schemas.base import PaginatedResponse
from app.db.models import User
from app.services import token_service
from . import router

@router.get("/list_generations", response_model=PaginatedResponse[TokenGenerationResponse])
def list_generations(
    page: int = 1, 
    page_size: int = 20, 
    q: str | None = Query(None),
    db: Session = Depends(get_db), 
    current_user: User = Depends(PermissionChecker("tokens.read"))
):
    return token_service.list_token_generations(db, page, page_size, q)

@router.get("/get_details_by_date/{target_date}", response_model=TokenDetailPaginatedResponse)
def get_details(target_date: date, page: int = 1, page_size: int = 20, db: Session = Depends(get_db), current_user: User = Depends(PermissionChecker("tokens.read"))):
    return token_service.get_token_details_by_date(target_date, db, page, page_size)

@router.get("/get_token_history_ledger", response_model=TokenDetailPaginatedResponse)
def list_history(
    start_date: date = Query(None), 
    end_date: date = Query(None), 
    page: int = 1, 
    page_size: int = 50, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(PermissionChecker("tokens.read"))
):
    return token_service.list_all_token_details(db, page, page_size, start_date, end_date)


@router.get("/view_history_ledger", response_model=TokenDetailPaginatedResponse)
def list_history_legacy(
    start_date: date = Query(None), 
    end_date: date = Query(None), 
    page: int = 1, 
    page_size: int = 50, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(PermissionChecker("tokens.read"))
):
    return list_history(start_date, end_date, page, page_size, db, current_user)



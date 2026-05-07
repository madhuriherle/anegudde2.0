from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, get_financial_year
from app.db.models import User, FinancialYear
from app.schemas.purchase import PurchaseEntryFullOut
from app.services.purchase_service import list_purchases as list_purchases_service
router = APIRouter()
@router.get("/list_purchases", response_model=list[PurchaseEntryFullOut])
def list_purchases(
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user),
    financial_year: FinancialYear = Depends(get_financial_year),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    q: str | None = Query(None),
    status: int | None = Query(None),
    search_field: str | None = Query(None),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
):
    return list_purchases_service(db, financial_year, page, page_size, q, status, search_field, from_date, to_date)


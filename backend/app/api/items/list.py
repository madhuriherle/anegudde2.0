from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_financial_year
from app.db.models import User, FinancialYear
from app.schemas.item import ItemOut
from app.services.item_service import list_items as list_items_service

router = APIRouter()


@router.get("/list_items", response_model=list[ItemOut])
def list_items(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    financial_year: FinancialYear = Depends(get_financial_year),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    q: str | None = Query(None),
    status: int | None = Query(None),
    category_id: int | None = Query(None),
    type_id: int | None = Query(None),
    search_field: str | None = Query(None),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    sort_by: str = Query("id"),
    sort_order: str = Query("desc"),
):
    return list_items_service(db, financial_year, page, page_size, q, status, category_id, type_id, search_field, sort_by, sort_order, from_date, to_date)


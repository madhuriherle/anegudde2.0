from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_financial_year
from app.db.models import User, FinancialYear
from app.schemas.item import ItemCreate, ItemOut
from app.services.item_service import create_item as create_item_service

router = APIRouter()


@router.post("/create_item", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(
    payload: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    financial_year: FinancialYear = Depends(get_financial_year),
    type_id: int | None = Query(None),
):
    return create_item_service(payload, db, current_user, financial_year, type_id)


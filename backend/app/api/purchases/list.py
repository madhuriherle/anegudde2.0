from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.schemas.purchase import PurchaseEntryFullOut
from app.services.purchase_service import list_purchases as list_purchases_service
router = APIRouter()
@router.get("/", response_model=list[PurchaseEntryFullOut])
def list_purchases(
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    q: str | None = Query(None),
    status: int | None = Query(None),
    search_field: str | None = Query(None),
):
    return list_purchases_service(db, page, page_size, q, status, search_field)


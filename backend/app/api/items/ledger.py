from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, PermissionChecker
from app.db.models import User
from app.schemas.stock_ledger import PaginatedStockLedgerOut
from app.services.item_service import get_item_ledger as get_item_ledger_service

router = APIRouter()


@router.get("/get_stock_ledger/{item_id}", response_model=PaginatedStockLedgerOut)
def get_item_ledger(
    item_id: int, 
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    db: Session = Depends(get_db), 
    current_user: User = Depends(PermissionChecker("items.read"))
):
    return get_item_ledger_service(item_id, db, page, page_size)

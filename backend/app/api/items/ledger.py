from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.schemas.stock_ledger import StockLedgerOut
from app.services.item_service import get_item_ledger as get_item_ledger_service

router = APIRouter()


@router.get("/{item_id}/ledger", response_model=list[StockLedgerOut])
def get_item_ledger(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return get_item_ledger_service(item_id, db)

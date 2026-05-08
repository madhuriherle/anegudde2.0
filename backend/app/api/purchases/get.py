from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.db.models import User
from app.schemas.purchase import PurchaseEntryFullOut
from app.services.purchase_service import get_purchase_full

router = APIRouter()

@router.get("/get_purchase/{purchase_id}", response_model=PurchaseEntryFullOut)
def read_purchase(purchase_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return get_purchase_full(purchase_id, db)

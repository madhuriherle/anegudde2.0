from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.db.models import User
from app.schemas.purchase import PurchaseEntryFullOut, PurchaseEntryUpdate
from app.services.purchase_service import update_purchase

router = APIRouter()

@router.put("/update_purchase/{purchase_id}", response_model=PurchaseEntryFullOut)
def modify_purchase(purchase_id: int, payload: PurchaseEntryUpdate, db: Session = Depends(get_db), current_user: User = Depends(PermissionChecker("purchases.write"))):
    return update_purchase(purchase_id, payload, db, current_user)

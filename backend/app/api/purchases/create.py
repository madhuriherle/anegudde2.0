from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.schemas.purchase import PurchaseEntryCreate, PurchaseEntryOut
from app.services.purchase_service import create_purchase as create_purchase_service
router = APIRouter()
@router.post("/", response_model=PurchaseEntryOut, status_code=status.HTTP_201_CREATED)
def create_purchase(payload: PurchaseEntryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return create_purchase_service(payload, db, current_user)


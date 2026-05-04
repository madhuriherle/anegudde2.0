from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.db.models import User
from app.services.purchase_service import delete_purchase

router = APIRouter()

@router.delete("/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_purchase(purchase_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    delete_purchase(purchase_id, db, current_user)
    return None

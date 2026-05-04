from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.db.models import User
from app.services.consumption_service import delete_consumption

router = APIRouter()

@router.delete("/{consumption_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_consumption(consumption_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    delete_consumption(consumption_id, db, current_user)
    return None

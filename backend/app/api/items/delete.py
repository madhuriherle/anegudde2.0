from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.services.item_service import delete_item as delete_item_service

router = APIRouter()


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    delete_item_service(item_id, db)
    return None

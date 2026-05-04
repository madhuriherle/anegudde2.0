from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.schemas.item import ItemOut, ItemUpdate
from app.services.item_service import update_item as update_item_service

router = APIRouter()


@router.put("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, payload: ItemUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return update_item_service(item_id, payload, db, current_user)

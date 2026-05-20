from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, PermissionChecker
from app.db.models import User
from app.schemas.item import ItemOut
from app.services.item_service import get_item as get_item_service, get_price_history as get_price_history_service

router = APIRouter()


@router.get("/get_item/{item_id}", response_model=ItemOut)
def get_item(
    item_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(PermissionChecker("items.read"))
):
    return get_item_service(item_id, db)


@router.get("/get_price_history/{item_id}")
def get_price_history(
    item_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(PermissionChecker("items.read"))
):
    return get_price_history_service(item_id, db)

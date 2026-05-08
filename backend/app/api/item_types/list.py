from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import ItemType, User
from app.schemas.item_type import ItemTypeOut

router = APIRouter()


@router.get("/list_item_types", response_model=list[ItemTypeOut])
def list_item_types(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    status: int | None = Query(None),
):
    query = db.query(ItemType)
    if status is not None:
        query = query.filter(ItemType.status == status)
    return query.order_by(ItemType.id.desc()).all()

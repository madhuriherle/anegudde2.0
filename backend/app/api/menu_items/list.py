from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from app.api.deps import get_db, PermissionChecker
from app.db.models import MenuItem, User
from app.schemas.menu_item import MenuItemOut

router = APIRouter()

@router.get("/list_menu_items", response_model=list[MenuItemOut])
def list_menu_items(
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("menu_items.read")),
    status: int | None = Query(None),
    q: str | None = Query(None)
):
    query = db.query(MenuItem).options(joinedload(MenuItem.unit))
    if status is not None:
        query = query.filter(MenuItem.status == status)
    if q:
        query = query.filter(MenuItem.dish_name.ilike(f"%{q}%"))
    
    return query.order_by(MenuItem.dish_name).all()

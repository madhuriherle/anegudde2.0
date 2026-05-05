from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.api.deps import get_db
from app.db.models import MenuItem
from app.schemas.menu_item import MenuItemOut

router = APIRouter()

@router.get("/", response_model=list[MenuItemOut])
def list_menu_items(
    db: Session = Depends(get_db),
    status: int = None,
    q: str = None
):
    query = db.query(MenuItem).options(joinedload(MenuItem.unit))
    if status is not None:
        query = query.filter(MenuItem.status == status)
    if q:
        query = query.filter(MenuItem.dish_name.ilike(f"%{q}%"))
    
    return query.order_by(MenuItem.dish_name).all()

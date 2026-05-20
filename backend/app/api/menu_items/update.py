from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.db.models import MenuItem, User
from app.schemas.menu_item import MenuItemUpdate, MenuItemOut

router = APIRouter()

@router.put("/update_menu_item/{item_id}", response_model=MenuItemOut)
def update_menu_item(
    item_id: int,
    payload: MenuItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("menu_items.write")),
):
    db_item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    if payload.dish_name:
        existing = db.query(MenuItem).filter(
            MenuItem.dish_name.ilike(payload.dish_name),
            MenuItem.id != item_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Dish name already exists")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(db_item, key, value)

    db_item.updated_at = datetime.now(timezone.utc)
    db_item.updated_by = current_user.id
    
    db.commit()
    db.refresh(db_item)
    return db_item

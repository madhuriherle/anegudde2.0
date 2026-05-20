from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, PermissionChecker
from app.db.models import MenuItem, User

router = APIRouter()

@router.delete("/delete_menu_item/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_menu_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("menu_items.delete"))
):
    db_item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    db_item.status = 0
    db_item.updated_at = datetime.now(timezone.utc)
    db_item.updated_by = current_user.id
    db.commit()
    return None

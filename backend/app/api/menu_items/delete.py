from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, PermissionChecker
from app.db.models import MenuItem, User

router = APIRouter()

@router.delete("/delete_menu_item/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_menu_item(
    item_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("menu_items.delete"))
):
    row = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    request.state.audit_meta = {"dish_name": row.dish_name}
    
    from datetime import datetime, timezone
    row.is_deleted = True
    row.deleted_at = datetime.now(timezone.utc)
    row.deleted_by_id = current_user.id
    db.commit()
    return None

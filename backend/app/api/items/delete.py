from fastapi import APIRouter, Depends, status, Request, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, PermissionChecker
from app.db.models import User, Item
from app.services.item_service import delete_item as delete_item_service

router = APIRouter()


@router.delete("/delete_item/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: User = Depends(PermissionChecker("items.delete"))
):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Attach snapshot metadata for audit logging before deletion
    request.state.audit_meta = {
        "item_name": item.item_name,
        "item_id": item.id
    }
    
    delete_item_service(item_id, db)
    return None

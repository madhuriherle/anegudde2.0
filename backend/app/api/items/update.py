from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import User
from app.schemas.item import ItemOut, ItemUpdate
from app.services.item_service import update_item as update_item_service

router = APIRouter()


@router.put("/update_item/{item_id}", response_model=ItemOut)
def update_item(
    item_id: int,
    payload: ItemUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("items.write")),
    type_id: int | None = Query(None),
):
    entry = update_item_service(item_id, payload, db, current_user, type_id)
    
    # Attach snapshot metadata for audit logging
    request.state.audit_meta = {
        "item_name": entry.item_name,
        "item_id": entry.id,
        "snapshot": {
            "id": entry.id,
            "item_name": entry.item_name,
            "category_id": entry.category_id,
            "unit_id": entry.unit_id,
            "current_stock": str(entry.current_stock) if entry.current_stock else None,
        }
    }
    
    return entry

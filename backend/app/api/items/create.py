from fastapi import APIRouter, Depends, Query, status, Request
from sqlalchemy.orm import Session

from app.api.deps import get_db, PermissionChecker
from app.db.models import User
from app.schemas.item import ItemCreate, ItemOut
from app.services.item_service import create_item as create_item_service

router = APIRouter()


@router.post("/create_item", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(
    payload: ItemCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("items.write")),
    type_id: int | None = Query(None),
):
    entry = create_item_service(payload, db, current_user, type_id)
    
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


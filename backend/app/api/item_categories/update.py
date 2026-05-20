from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import ItemCategory, ItemType, User
from app.schemas.item_category import ItemCategoryOut, ItemCategoryUpdate
router = APIRouter()
@router.put("/update_category/{category_id}", response_model=ItemCategoryOut)
def update_category(category_id: int, payload: ItemCategoryUpdate, db: Session = Depends(get_db), current_user: User = Depends(PermissionChecker("item_categories.write"))):
    row = db.query(ItemCategory).filter(ItemCategory.id == category_id).first()
    if not row: raise HTTPException(status_code=404, detail="Category not found")
    if payload.type_id is not None:
        item_type = db.query(ItemType).filter(ItemType.id == payload.type_id, ItemType.status == 1).first()
        if not item_type:
            raise HTTPException(status_code=400, detail="Invalid type_id")
    for k, v in payload.model_dump(exclude_unset=True).items(): setattr(row, k, v)
    row.updated_at = datetime.now(timezone.utc); row.updated_by = current_user.id
    db.commit(); db.refresh(row)
    return row

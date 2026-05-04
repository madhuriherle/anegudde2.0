from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import ItemCategory, User
from app.schemas.item_category import ItemCategoryOut, ItemCategoryUpdate
router = APIRouter()
@router.put("/{category_id}", response_model=ItemCategoryOut)
def update_category(category_id: int, payload: ItemCategoryUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.query(ItemCategory).filter(ItemCategory.id == category_id).first()
    if not row: raise HTTPException(status_code=404, detail="Category not found")
    for k, v in payload.model_dump(exclude_unset=True).items(): setattr(row, k, v)
    row.updated_at = datetime.now(timezone.utc); row.updated_by = current_user.id
    db.commit(); db.refresh(row)
    return row

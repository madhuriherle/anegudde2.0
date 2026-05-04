from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import ItemCategory, User
from app.schemas.item_category import ItemCategoryCreate, ItemCategoryOut
router = APIRouter()
@router.post("/", response_model=ItemCategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: ItemCategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    exists = db.query(ItemCategory).filter(ItemCategory.category_name == payload.category_name).first()
    if exists: raise HTTPException(status_code=400, detail="category_name already exists")
    now = datetime.now(timezone.utc)
    row = ItemCategory(**payload.model_dump(), created_at=now, updated_at=now, created_by=current_user.id, updated_by=current_user.id)
    db.add(row); db.commit(); db.refresh(row)
    return row


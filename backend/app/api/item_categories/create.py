from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import ItemCategory, ItemType, User
from app.schemas.item_category import ItemCategoryCreate, ItemCategoryOut
router = APIRouter()
@router.post("/", response_model=ItemCategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: ItemCategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    resolved_type_id = payload.type_id
    if resolved_type_id is None:
        kitchen_type = db.query(ItemType).filter(ItemType.type_name == "Kitchen", ItemType.status == 1).first()
        if not kitchen_type:
            raise HTTPException(status_code=400, detail="Kitchen type not found")
        resolved_type_id = kitchen_type.id

    item_type = db.query(ItemType).filter(ItemType.id == resolved_type_id, ItemType.status == 1).first()
    if not item_type:
        raise HTTPException(status_code=400, detail="Invalid type_id")
    exists = db.query(ItemCategory).filter(
        ItemCategory.type_id == resolved_type_id,
        ItemCategory.category_name == payload.category_name
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="category_name already exists for this type")
    now = datetime.now(timezone.utc)
    row = ItemCategory(
        **payload.model_dump(exclude={"type_id"}),
        type_id=resolved_type_id,
        created_at=now,
        updated_at=now,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(row); db.commit(); db.refresh(row)
    return row


from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import ItemCategory, User
from app.schemas.item_category import ItemCategoryOut
from app.schemas.base import PaginatedResponse
import math

router = APIRouter()

@router.get("/list_categories", response_model=PaginatedResponse[ItemCategoryOut])
def list_categories(
    db: Session = Depends(get_db), 
    _: User = Depends(PermissionChecker("item_categories.read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    q: str | None = Query(None),
    status: int | None = Query(None),
    search_field: str | None = Query(None),
    type_id: int | None = Query(None),
):
    query = db.query(ItemCategory)
    if status is not None:
        query = query.filter(ItemCategory.status == status)
    if type_id is not None:
        query = query.filter(ItemCategory.type_id == type_id)
    if q:
        like = f"%{q}%"
        from sqlalchemy import String
        if search_field == "name":
            query = query.filter(ItemCategory.category_name.ilike(like))
        elif search_field == "id":
            query = query.filter(ItemCategory.id.cast(String).ilike(like))
        else:
            query = query.filter(ItemCategory.category_name.ilike(like) | ItemCategory.id.cast(String).ilike(like))
    
    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(ItemCategory.id.desc()).offset(offset).limit(page_size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }


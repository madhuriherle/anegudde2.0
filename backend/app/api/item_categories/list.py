from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, get_financial_year
from app.db.models import ItemCategory, User, FinancialYear
from app.schemas.item_category import ItemCategoryOut

router = APIRouter()

@router.get("/list_categories", response_model=list[ItemCategoryOut])
def list_categories(
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user),
    financial_year: FinancialYear = Depends(get_financial_year),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    q: str | None = Query(None),
    search_field: str | None = Query(None),
    type_id: int | None = Query(None),
):
    query = db.query(ItemCategory).filter(ItemCategory.financial_year_id == financial_year.id)
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
    
    query = query.order_by(ItemCategory.id.desc())
    offset = (page - 1) * page_size
    return query.offset(offset).limit(page_size).all()


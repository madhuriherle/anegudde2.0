from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import Unit, User
from app.schemas.unit import UnitOut

router = APIRouter()

@router.get("/list_units", response_model=list[UnitOut])
def list_units(
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    q: str | None = Query(None),
    search_field: str | None = Query(None),
):
    query = db.query(Unit)
    if q:
        like = f"%{q}%"
        if search_field == "name":
            query = query.filter(Unit.unit_name.ilike(like))
        elif search_field == "code":
            query = query.filter(Unit.unit_code.ilike(like))
        elif search_field == "id":
            from sqlalchemy import String
            query = query.filter(Unit.id.cast(String).ilike(like))
        else:
            from sqlalchemy import String
            query = query.filter(Unit.unit_name.ilike(like) | Unit.unit_code.ilike(like) | Unit.id.cast(String).ilike(like))
    
    query = query.order_by(Unit.id.desc())
    offset = (page - 1) * page_size
    return query.offset(offset).limit(page_size).all()


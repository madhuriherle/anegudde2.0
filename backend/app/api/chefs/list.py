from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.db.models import Chef, User
from app.schemas.chef import ChefOut

router = APIRouter()

@router.get("/", response_model=list[ChefOut])
def list_chefs(
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    q: str | None = Query(None),
    status: int | None = Query(None),
    search_field: str | None = Query(None),
):
    query = db.query(Chef)
    if status is not None:
        query = query.filter(Chef.status == status)
    if q:
        like = f"%{q}%"
        if search_field == "name":
            query = query.filter(Chef.chef_name.ilike(like))
        elif search_field == "phone":
            query = query.filter(Chef.phone.ilike(like))
        elif search_field == "id":
            from sqlalchemy import String
            query = query.filter(Chef.id.cast(String).ilike(like))
        else:
            from sqlalchemy import String
            query = query.filter(Chef.chef_name.ilike(like) | Chef.phone.ilike(like) | Chef.id.cast(String).ilike(like))
    
    query = query.order_by(Chef.id.desc())
    offset = (page - 1) * page_size
    return query.offset(offset).limit(page_size).all()


from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.schemas.user import UserOut
from app.schemas.base import PaginatedResponse
import math

router = APIRouter()


@router.get("/list_users", response_model=PaginatedResponse[UserOut])
def list_users(
    db: Session = Depends(get_db), 
    _: User = Depends(get_current_user), 
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    q: str | None = Query(None),
    status: int | None = Query(1),
    search_field: str | None = Query(None),
):
    query = db.query(User)
    if status is not None:
        query = query.filter(User.status == status)
    if q:
        like = f"%{q}%"
        if search_field == "username":
            query = query.filter(User.username.ilike(like))
        elif search_field == "name":
            query = query.filter(User.full_name.ilike(like))
        elif search_field == "email":
            query = query.filter(User.email.ilike(like))
        elif search_field == "role":
            query = query.filter(User.role.ilike(like))
        else:
            query = query.filter(User.username.ilike(like) | User.full_name.ilike(like) | User.email.ilike(like) | User.role.ilike(like))
    
    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(User.id.desc()).offset(offset).limit(page_size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 0
    }


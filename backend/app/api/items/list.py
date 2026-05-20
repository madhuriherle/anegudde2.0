from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, PermissionChecker
from app.db.models import User
from app.schemas.item import ItemOut
from app.schemas.base import PaginatedResponse
from app.services.item_service import list_items as list_items_service

router = APIRouter()


@router.get("/list_items", response_model=PaginatedResponse[ItemOut])
def list_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("items.read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    q: str | None = Query(None),
    status: int | None = Query(None),
    category_id: int | None = Query(None),
    type_id: int | None = Query(None),
    search_field: str | None = Query(None),
    sort_by: str = Query("id"),
    sort_order: str = Query("desc"),
):
    return list_items_service(db, page, page_size, q, status, category_id, type_id, search_field, sort_by, sort_order)


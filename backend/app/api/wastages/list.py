from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import User
from app.schemas.wastage import WastageEntryFullOut
from app.schemas.base import PaginatedResponse
from app.services.wastage_service import list_wastages as list_wastages_service

router = APIRouter()

@router.get("/list_wastages", response_model=PaginatedResponse[WastageEntryFullOut])
def list_wastages(
    db: Session = Depends(get_db),
    _: User = Depends(PermissionChecker("daily_usage.read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    q: str | None = Query(None),
    status: int | None = Query(1),
    search_field: str | None = Query(None),
):

    return list_wastages_service(db, page, page_size, q, status, search_field)



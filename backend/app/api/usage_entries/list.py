from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, PermissionChecker
from app.db.models import User
from app.schemas.consumption import ConsumptionEntryFullOut
from app.schemas.base import PaginatedResponse
from app.services.consumption_service import list_consumptions as list_consumptions_service

router = APIRouter()

@router.get("/list_consumptions", response_model=PaginatedResponse[ConsumptionEntryFullOut])
def list_consumptions(
    db: Session = Depends(get_db), 
    _: User = Depends(PermissionChecker("daily_usage.read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    q: str | None = Query(None),
    status: int | None = Query(1),
    search_field: str | None = Query(None),
):
    return list_consumptions_service(db, page, page_size, q, status, search_field)

